import { createContext, useContext } from "react";
import { useApi } from "../lib/hooks";
import { useAuth } from "./auth";

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const { user } = useAuth();
  const account = useApi("/account/", { enabled: Boolean(user), interval: 60000 });
  return <AccountContext.Provider value={user ? account : { data: null, reload: () => {} }}>{children}</AccountContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAccount = () => useContext(AccountContext);
