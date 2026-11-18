import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./state/auth";
import { AccountProvider } from "./state/account";
import { PrefsProvider } from "./state/prefs";
import App from "./App";
import "@fontsource-variable/geist";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PrefsProvider>
          <AccountProvider>
            <App />
          </AccountProvider>
        </PrefsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
