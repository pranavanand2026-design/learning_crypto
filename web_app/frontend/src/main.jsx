import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./state/auth";
import { AccountProvider } from "./state/account";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AccountProvider>
          <App />
        </AccountProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
