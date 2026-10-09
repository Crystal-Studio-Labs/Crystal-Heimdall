const API_BASE = "/api/v1";

export function getAuthToken(): string | null {
  return localStorage.getItem("heimdall_token");
}

export function setAuthToken(token: string) {
  localStorage.setItem("heimdall_token", token);
}

export function clearAuthToken() {
  localStorage.removeItem("heimdall_token");
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
