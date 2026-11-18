// Formatting honours the viewer's display currency, region and time zone.
// Paper accounts are kept in USD; values are converted only for display.
const display = {
  currency: "USD",
  rate: 1,
  locale: typeof navigator !== "undefined" ? navigator.language : "en-US",
  timeZone: undefined,
};

export function setDisplay(next) {
  Object.assign(display, next);
  Object.keys(cache).forEach((k) => delete cache[k]);
}
export const getDisplay = () => ({ ...display });
export const toDisplay = (usd) => (usd === null || usd === undefined ? usd : usd * display.rate);
export const toUsd = (local) => local / display.rate;

const cache = {};
function currencyFormat(digits, opts = {}) {
  const key = `${digits}:${opts.notation || ""}:${opts.currency || display.currency}`;
  if (!cache[key]) {
    cache[key] = new Intl.NumberFormat(display.locale, {
      style: "currency",
      currency: opts.currency || display.currency,
      minimumFractionDigits: opts.notation ? undefined : digits,
      maximumFractionDigits: digits,
      notation: opts.notation,
    });
  }
  return cache[key];
}

/** Format a USD amount in the viewer's currency. */
export function money(usd, opts = {}) {
  if (usd === null || usd === undefined || Number.isNaN(usd)) return "–";
  const value = opts.raw ? usd : toDisplay(usd);
  const abs = Math.abs(value);
  let out;
  if (opts.digits === undefined && abs > 0 && abs < 1) {
    // Small prices: keep four significant figures (0.004802, 0.9785).
    out = new Intl.NumberFormat(display.locale, { style: "currency", currency: display.currency, maximumSignificantDigits: 4 }).format(value);
  } else {
    let digits = opts.digits ?? 2;
    if (opts.digits === undefined && (["JPY", "KRW", "IDR"].includes(display.currency) || abs >= 100000)) digits = 0;
    out = currencyFormat(digits).format(value);
  }
  return opts.sign && value > 0 ? `+${out}` : out;
}

export function compact(usd) {
  if (usd === null || usd === undefined) return "–";
  return currencyFormat(2, { notation: "compact" }).format(toDisplay(usd));
}

export function number(value, opts = {}) {
  if (value === null || value === undefined) return "–";
  return new Intl.NumberFormat(display.locale, { notation: opts.compact ? "compact" : undefined, maximumFractionDigits: opts.digits ?? 2 }).format(value);
}

export function currencySymbol(code = display.currency) {
  return (
    new Intl.NumberFormat(display.locale, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value || code
  );
}

export function pct(value, { sign = true, digits } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  // 0.08%, 2.9%, 26%: precision only where it means something.
  if (digits === undefined) digits = Math.abs(value) >= 10 ? 0 : Math.abs(value) >= 1 ? 1 : 2;
  const s = `${new Intl.NumberFormat(display.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(value))}%`;
  if (!sign) return s;
  return value > 0 ? `+${s}` : value < 0 ? `−${s}` : s;
}

export function qty(value) {
  if (value === null || value === undefined) return "–";
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 8;
  return new Intl.NumberFormat(display.locale, { maximumFractionDigits: digits }).format(value);
}

const rtf = () => new Intl.RelativeTimeFormat(display.locale, { numeric: "auto", style: "short" });

export function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return rtf().format(0, "second");
  if (diff < 3600) return rtf().format(-Math.floor(diff / 60), "minute");
  if (diff < 86400) return rtf().format(-Math.floor(diff / 3600), "hour");
  if (diff < 7 * 86400) return rtf().format(-Math.floor(diff / 86400), "day");
  return day(iso);
}

export function day(iso, opts = { month: "short", day: "numeric" }) {
  return new Date(iso).toLocaleDateString(display.locale, { timeZone: display.timeZone, ...opts });
}

export function time(iso) {
  return new Date(iso).toLocaleTimeString(display.locale, { timeZone: display.timeZone, hour: "numeric", minute: "2-digit" });
}

export function dateTime(iso) {
  return new Date(iso).toLocaleString(display.locale, { timeZone: display.timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function until(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return day(iso, { weekday: "short", month: "short", day: "numeric" });
}

export function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: display.timeZone }));
  return h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export const tone = (v) => (v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-graphite");
