# Reinicia backend + frontend de LegoMarkal de forma limpia y valida que ambos quedan arriba.
param(
    [string]$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path,
    [int]$BackendPort = 8011,
    [int]$FrontendPort = 3000,
    [int]$MaxAttempts = 30
)

$ErrorActionPreference = "Stop"

function Stop-PortListeners {
    param([int[]]$Ports)

    foreach ($port in $Ports) {
        $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($listeners) {
            $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
            foreach ($procId in $pids) {
                try {
                    Stop-Process -Id $procId -Force -ErrorAction Stop
                    Write-Host "[stop] puerto $port -> PID $procId detenido"
                } catch {
                    Write-Host "[warn] no se pudo detener PID $procId en puerto $port"
                }
            }
        } else {
            Write-Host "[ok] puerto $port ya libre"
        }
    }
}

function Wait-Endpoint {
    param(
        [string]$Url,
        [int]$Attempts = 30,
        [int]$SleepSeconds = 1
    )

    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 400) {
                Write-Host "[ok] $Url -> $($res.StatusCode)"
                return $true
            }
        } catch {
            # reintento
        }

        Start-Sleep -Seconds $SleepSeconds
    }

    Write-Host "[err] timeout esperando $Url"
    return $false
}

$apiDir = Join-Path $RepoRoot "api"
$webDir = Join-Path $RepoRoot "admin-panel"
$pythonExe = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$nextCache = Join-Path $webDir ".next"
$psExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path $pythonExe)) {
    throw "No existe python del venv en: $pythonExe"
}
if (-not (Test-Path $apiDir)) {
    throw "No existe directorio API: $apiDir"
}
if (-not (Test-Path $webDir)) {
    throw "No existe directorio frontend: $webDir"
}
if (-not (Test-Path $psExe)) {
    throw "No existe powershell.exe en: $psExe"
}

# Limpieza previa: puertos principales historicos del proyecto.
Stop-PortListeners -Ports @($FrontendPort, 8000, 8010, 8011, 8020)

# Limpiar cache de Next para evitar chunks obsoletos.
if (Test-Path $nextCache) {
    Remove-Item -Recurse -Force $nextCache
    Write-Host "[clean] eliminado $nextCache"
}

# Arranque backend en consola separada usando script temporal.
$backendTempScript = Join-Path $env:TEMP "legomarkal-backend-$BackendPort.ps1"
$backendCmd = @"
Set-Location '$apiDir'
Get-Content .env | ForEach-Object {
    if (`$_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        `$name = `$matches[1]
        `$value = `$matches[2].Trim().Trim('"')
        Set-Item -Path Env:`$name -Value `$value
    }
}
& '$pythonExe' -m uvicorn app.main:app --host 127.0.0.1 --port $BackendPort --log-level warning
"@
Set-Content -Path $backendTempScript -Value $backendCmd -Encoding UTF8

$backendProc = Start-Process -FilePath $psExe -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $backendTempScript) -PassThru
Write-Host "[start] backend PID=$($backendProc.Id) en http://127.0.0.1:$BackendPort"

# Arranque frontend en consola separada usando script temporal.
$frontendTempScript = Join-Path $env:TEMP "legomarkal-frontend-$FrontendPort.ps1"
$frontendCmd = @"
Set-Location '$webDir'
`$env:NEXT_PUBLIC_API_URL='http://127.0.0.1:$BackendPort'
npm run dev -- -p $FrontendPort
"@
Set-Content -Path $frontendTempScript -Value $frontendCmd -Encoding UTF8

$frontendProc = Start-Process -FilePath $psExe -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $frontendTempScript) -PassThru
Write-Host "[start] frontend PID=$($frontendProc.Id) en http://localhost:$FrontendPort"

$backendOk = Wait-Endpoint -Url "http://127.0.0.1:$BackendPort/health" -Attempts $MaxAttempts
$frontendOk = Wait-Endpoint -Url "http://localhost:$FrontendPort/dashboard" -Attempts $MaxAttempts

if (-not ($backendOk -and $frontendOk)) {
    throw "Relanzado incompleto: backendOk=$backendOk frontendOk=$frontendOk"
}

Write-Host "[ready] Todo relanzado y validado"
Write-Host "        API:  http://127.0.0.1:$BackendPort"
Write-Host "        WEB:  http://localhost:$FrontendPort"
