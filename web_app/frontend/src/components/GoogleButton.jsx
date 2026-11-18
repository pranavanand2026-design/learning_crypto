import { useEffect, useRef, useState } from "react";

const SCRIPT = "https://accounts.google.com/gsi/client";
let loading = null;

function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => {
        loading = null;
        reject(new Error("Google sign-in couldn't load."));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

/** Google's official "Continue with Google" button (Google Identity Services). */
export default function GoogleButton({ clientId, onCredential, text = "continue_with" }) {
  const el = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !el.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => onCredential(res.credential),
          ux_mode: "popup",
          auto_select: false,
          itp_support: true,
        });
        const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
        window.google.accounts.id.renderButton(el.current, {
          type: "standard",
          theme: dark ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text,
          logo_alignment: "left",
          width: Math.min(el.current.offsetWidth || 384, 400),
        });
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential, text]);

  if (!clientId) return null;
  return (
    <div>
      <div ref={el} className="flex min-h-[44px] w-full justify-center" />
      {error && <p className="mt-2 text-sm text-graphite">{error}</p>}
    </div>
  );
}
