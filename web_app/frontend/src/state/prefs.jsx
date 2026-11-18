import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { setDisplay } from "../lib/format";
import { useAuth } from "./auth";

const PrefsContext = createContext(null);

function validLocale(tag) {
  if (!tag || tag === "auto") return null;
  try {
    return Intl.getCanonicalLocales(tag)[0];
  } catch {
    return null;
  }
}

/**
 * Applies the signed-in user's currency, region and time zone to all
 * formatting. Children remount when these change so every number updates.
 */
export function PrefsProvider({ children }) {
  const { user } = useAuth();
  const [rates, setRates] = useState(null);
  const currency = user?.preferred_currency || "USD";
  const locale = validLocale(user?.date_format) || navigator.language;
  const timeZone = user?.timezone || undefined;

  useEffect(() => {
    api("/fx/").then((r) => setRates(r.rates)).catch(() => setRates({}));
  }, []);

  const rate = currency === "USD" ? 1 : rates?.[currency];
  const effective = rate ? currency : "USD";
  setDisplay({ currency: effective, rate: rate || 1, locale, timeZone });

  return (
    <PrefsContext.Provider value={{ rates, currency: effective }}>
      <div key={`${effective}|${locale}|${timeZone}`} className="contents">
        {children}
      </div>
    </PrefsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePrefs = () => useContext(PrefsContext);
