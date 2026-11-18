// Small fetch wrapper: keeps the access token in memory and refreshes it
// from the httpOnly cookie when it expires.
let accessToken = null;
let refreshing = null;

export function setToken(token) {
  accessToken = token;
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.detail ? flatten(body.detail) : `Request failed (${status})`);
    this.status = status;
    this.code = body?.code;
    this.body = body;
  }
}

function flatten(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.join(" ");
  if (detail && typeof detail === "object") {
    return Object.entries(detail)
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join(" ") : v}`)
      .join(" ");
  }
  return "Something went wrong.";
}

export async function refresh() {
  if (!refreshing) {
    refreshing = fetch("/api/accounts/refresh/", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new ApiError(r.status, null);
        const body = await r.json();
        accessToken = body.access_token;
        return accessToken;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function api(path, { method = "GET", body, retry = true, signal } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 401 && retry && accessToken) {
    try {
      await refresh();
      return api(path, { method, body, retry: false, signal });
    } catch {
      accessToken = null;
    }
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}
