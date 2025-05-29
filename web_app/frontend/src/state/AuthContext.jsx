import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load initial token
  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("/api/accounts/refresh/", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("No valid refresh token");
        const data = await res.json();
        setAccessToken(data.access_token);
      } catch {
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    };
    refresh();
  }, []);

  const logout = async () => {
    try {
      const csrfToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrftoken="))
        ?.split("=")[1];

      await fetch("/api/accounts/logout/", {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRFToken": csrfToken,
        },
      });

      setAccessToken(null);
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout failed:", err);
      alert("Logout failed. Try again.");
    }
  };

  const authFetch = async (url, options = {}, anonymous = false) => {
    const fullUrl = url.startsWith("/api") ? url : `/api${url}`;
    const method = (options.method || "GET").toUpperCase();

    const needsCsrf = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    const getCookie = (name) =>
      document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${name}=`))
        ?.split("=")[1];

    if (needsCsrf && !getCookie("csrftoken")) {
      try {
        await fetch("/api/csrf/", { credentials: "include" });
      } catch {}
    }

    const csrfToken = getCookie("csrftoken");

    const headers = {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
      ...(accessToken && !anonymous ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    };

    let response = await fetch(fullUrl, {
      ...options,
      credentials: "include",
      headers,
    });

    // Refresh on 401
  if (response.status === 401 && !anonymous && accessToken) {
  try {
    const refreshRes = await fetch("/api/accounts/refresh/", { credentials: "include" });
    if (refreshRes.ok) {
      const refreshData = await refreshRes.json();
      setAccessToken(refreshData.access_token);

      response = await fetch(fullUrl, {
        ...options,
        credentials: "include",
        headers: {
          ...headers,
          Authorization: `Bearer ${refreshData.access_token}`,
        },
      });
    } else {
      setAccessToken(null);
      // Only redirect if user was logged in
      window.location.href = "/login";
      throw new Error("Session expired. Please login again.");
    }
  } catch (refreshError) {
    setAccessToken(null);
    if (accessToken) window.location.href = "/login"; // only if logged in
    throw refreshError;
  }
}


    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || `HTTP error! status: ${response.status}`);
    }

    return data;
  };

  return (
    <AuthContext.Provider
      value={{ accessToken, setAccessToken, logout, loading, authFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
