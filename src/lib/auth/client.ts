"use client";

/** Ends the session on the server, then sends the user to the sign-in screen. */
export async function signOut() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.assign("/login");
  }
}

/**
 * fetch() for authenticated API calls: if the 15-minute access token expired (401), refresh once and retry.
 * Prefer this over bare fetch for new client code that talks to /api/*.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 401) return res;
  const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
  if (!refreshed.ok) {
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    return res;
  }
  return fetch(input, init);
}
