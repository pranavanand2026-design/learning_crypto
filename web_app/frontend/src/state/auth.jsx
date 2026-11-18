import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, refresh, setToken } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState({ recaptcha_site_key: null, starting_cash: 10000 });

  const loadProfile = useCallback(async () => {
    const res = await api("/accounts/profile/");
    const profile = res.data ?? res;
    setUser(profile);
    return profile;
  }, []);

  useEffect(() => {
    api("/config/").then(setConfig).catch(() => {});
    refresh()
      .then(loadProfile)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, [loadProfile]);

  const login = async (email, password, captcha_token) => {
    const res = await api("/accounts/login/", { method: "POST", body: { email, password, captcha_token }, retry: false });
    setToken(res.access_token);
    return loadProfile();
  };

  const signup = async ({ email, password, display_name, captcha_token }) => {
    await api("/accounts/register/", { method: "POST", body: { email, password, display_name }, retry: false });
    return login(email, password, captcha_token);
  };

  const logout = async () => {
    try {
      await api("/accounts/logout/", { method: "POST" });
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, ready, config, login, signup, logout, setUser, loadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
