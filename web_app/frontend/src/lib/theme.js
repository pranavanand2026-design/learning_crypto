import { useEffect, useState } from "react";

/** Read a design token as an rgba() string usable outside CSS (e.g. canvas). */
export function tokenColor(name, alpha = 1) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const [r, g, b] = raw.split(/\s+/).map(Number);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function currentTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit) return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState(currentTheme);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setThemeState(currentTheme());
    mq.addEventListener("change", update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", update);
      obs.disconnect();
    };
  }, []);
  const setTheme = (next) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage unavailable */
    }
  };
  return [theme, setTheme];
}
