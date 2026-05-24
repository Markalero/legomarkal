@echo off
title LEGO Stock Manager PRO - Local Runner
cls

echo ==========================================================
echo       LEGO STOCK MANAGER PRO - STARTUP UTILITY
echo ==========================================================
echo.

:: 1. Verify Node.js and Python installations
echo [1/5] Checking dependencies...
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH. Please install Node.js.
    pause
    exit /b 1
)

where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not installed or not in PATH. Please install Python.
    pause
    exit /b 1
)
echo      - Node.js and Python detected successfully.
echo.

:: 2. Setup Backend Python Virtual Environment & Install packages
echo [2/5] Setting up Python backend environment...
cd backend
if not exist .venv (
    echo      - Creating virtual environment...
    python -m venv .venv
)

echo      - Installing backend dependencies...
call .venv\Scripts\python -m pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install Python dependencies.
    cd ..
    pause
    exit /b 1
)

:: Install playwright browsers
echo      - Installing Playwright headless browsers...
call .venv\Scripts\playwright install chromium
cd ..
echo.

:: 3. Setup Frontend Node modules & Build
echo [3/5] Setting up Node.js frontend environment...
cd frontend
if not exist node_modules (
    echo      - Installing frontend dependencies - this may take a minute...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install frontend dependencies.
        cd ..
        pause
        exit /b 1
    )
)

echo      - Compiling Next.js production build...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Next.js compilation failed.
    cd ..
    pause
    exit /b 1
)
cd ..
echo.

:: 4. Start backend in a separate background console window
echo [4/5] Starting FastAPI backend on http://127.0.0.1:8000 ...
cd backend
start "LEGO Stock Manager API" cmd /k "call .venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000"
cd ..
echo.

:: 5. Open browser and start frontend server
echo [5/5] Launching browser and starting frontend server...
:: Wait a couple seconds for backend to start up using ping delay
ping -n 4 127.0.0.1 >nul

:: Open browser to localhost:3000
start http://localhost:3000

:: Start frontend server
cd frontend
echo      - Next.js server running on http://localhost:3000. Close this window to stop the application.
call npm run start
