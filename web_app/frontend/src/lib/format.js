const usd = (digits) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

const cache = {};
export function money(value, opts = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  const abs = Math.abs(value);
  let digits = opts.digits;
  if (digits === undefined) digits = abs >= 1000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  cache[digits] ||= usd(digits);
  const out = cache[digits].format(value);
  return opts.sign && value > 0 ? `+${out}` : out;
}

export function compact(value) {
  if (value === null || value === undefined) return "–";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2, style: "currency", currency: "USD" }).format(value);
}

export function pct(value, { sign = true, digits = 2 } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  const s = `${Math.abs(value).toFixed(digits)}%`;
  if (!sign) return s;
  return value > 0 ? `+${s}` : value < 0 ? `−${s}` : s;
}

export function qty(value) {
  if (value === null || value === undefined) return "–";
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 8;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
}

export function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function dateTime(iso) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function until(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export const tone = (v) => (v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-graphite");
