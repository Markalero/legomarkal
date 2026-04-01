// Helpers de autenticación: almacenamiento de token JWT en cookie httpOnly vía API route
// En V1, el token se guarda en localStorage para simplificar (sin SSR sensible).

const TOKEN_KEY = "lm_token";

export function storeToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export function removeToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    // Comprobación rápida de expiración leyendo el payload JWT (sin verificar firma)
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
