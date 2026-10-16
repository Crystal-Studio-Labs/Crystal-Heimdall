const API_BASE = "/api/v1";

export interface SessionInfo {
  token: string | null;
  isValid: boolean;
  operator: string | null;
  expiresAt: number | null;
  daysRemaining: number;
}

// Safely decodes base64 payload from JWT without external libraries
function parseJwtPayload(token: string): { exp?: number; operator?: string; authenticated?: boolean } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  const token = localStorage.getItem("heimdall_token");
  if (!token) return null;

  // Check if token has an expiration and verify it is not expired
  const payload = parseJwtPayload(token);
  if (payload && typeof payload.exp === "number") {
    // If expired, clear it
    if (payload.exp * 1000 <= Date.now()) {
      clearAuthToken();
      return null;
    }
  }

  // Also check local session expiration timestamp if recorded
  const expiresTimestamp = localStorage.getItem("heimdall_session_expires");
  if (expiresTimestamp) {
    const expNum = parseInt(expiresTimestamp, 10);
    if (!isNaN(expNum) && expNum <= Date.now()) {
      clearAuthToken();
      return null;
    }
  }

  return token;
}

export function setAuthToken(token: string) {
  localStorage.setItem("heimdall_token", token);
  
  const payload = parseJwtPayload(token);
  const now = Date.now();
  // Default to 30 days (minimum 7 days guaranteed) if not extracted from JWT
  let expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  if (payload && typeof payload.exp === "number") {
    expiresAt = payload.exp * 1000;
  }
  
  localStorage.setItem("heimdall_session_created", now.toString());
  localStorage.setItem("heimdall_session_expires", expiresAt.toString());
  if (payload?.operator) {
    localStorage.setItem("heimdall_operator_name", payload.operator);
  }
}

export function clearAuthToken() {
  localStorage.removeItem("heimdall_token");
  localStorage.removeItem("heimdall_session_created");
  localStorage.removeItem("heimdall_session_expires");
  localStorage.removeItem("heimdall_operator_name");
}

export function isOperatorAuthenticated(): boolean {
  return Boolean(getAuthToken());
}

export function getSessionInfo(): SessionInfo {
  const token = getAuthToken();
  if (!token) {
    return {
      token: null,
      isValid: false,
      operator: null,
      expiresAt: null,
      daysRemaining: 0,
    };
  }

  const payload = parseJwtPayload(token);
  const expiresTimestamp = localStorage.getItem("heimdall_session_expires");
  let expTime: number = Date.now() + 7 * 24 * 60 * 60 * 1000;

  if (payload?.exp) {
    expTime = payload.exp * 1000;
  } else if (expiresTimestamp) {
    expTime = parseInt(expiresTimestamp, 10);
  }

  const daysRemaining = Math.max(0, Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24)));

  return {
    token,
    isValid: true,
    operator: payload?.operator || localStorage.getItem("heimdall_operator_name") || "Operator",
    expiresAt: expTime,
    daysRemaining,
  };
}

export async function verifySessionWithServer(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return Boolean(data.authenticated);
    } else if (res.status === 401) {
      clearAuthToken();
      return false;
    }
    return true;
  } catch {
    // Offline resilience: don't log out if backend is temporarily unreachable
    return true;
  }
}

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !endpoint.startsWith("/auth")) {
    clearAuthToken();
    window.location.href = "/login";
  }

  return res;
}
