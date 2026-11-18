// Eight preset avatars, each a small abstract scene in the brand palette.
// eslint-disable-next-line react-refresh/only-export-components
export const PRESETS = {
  comet: { bg: ["#142430", "#2B4A5E"], draw: <><circle cx="40" cy="22" r="7" fill="#F3E46B" /><path d="M35 27L14 48" stroke="#F3E46B" strokeWidth="4" strokeLinecap="round" opacity=".55" /></> },
  orbit: { bg: ["#1F3A4D", "#3E6A78"], draw: <><circle cx="32" cy="32" r="9" fill="#F3E46B" /><ellipse cx="32" cy="32" rx="21" ry="8" fill="none" stroke="#EDF1EE" strokeWidth="2.5" transform="rotate(-25 32 32)" /></> },
  spark: { bg: ["#F3E46B", "#E2B93B"], draw: <path d="M32 12l5 15 15 5-15 5-5 15-5-15-15-5 15-5z" fill="#142430" /> },
  wave: { bg: ["#1F6E5B", "#3E9A80"], draw: <path d="M8 38c8-10 16-10 24 0s16 10 24 0" fill="none" stroke="#EDF1EE" strokeWidth="5" strokeLinecap="round" /> },
  peak: { bg: ["#EDF1EE", "#C9D4CE"], draw: <><path d="M10 46l14-20 9 12 6-7 15 15z" fill="#142430" /><circle cx="44" cy="20" r="5" fill="#E2B93B" /></> },
  bloom: { bg: ["#A6473A", "#D2735F"], draw: <g fill="#F7E7D8">{[0, 60, 120, 180, 240, 300].map((r) => <ellipse key={r} cx="32" cy="20" rx="5" ry="10" transform={`rotate(${r} 32 32)`} />)}<circle cx="32" cy="32" r="5" fill="#F3E46B" /></g> },
  prism: { bg: ["#2A2F4F", "#4F5A8C"], draw: <><path d="M32 12l18 32H14z" fill="none" stroke="#EDF1EE" strokeWidth="3" strokeLinejoin="round" /><path d="M40 30l14 6M40 30l14 12" stroke="#F3E46B" strokeWidth="2.5" strokeLinecap="round" /></> },
  tide: { bg: ["#0E1418", "#26343C"], draw: <><circle cx="32" cy="32" r="16" fill="#F3E46B" /><circle cx="39" cy="27" r="14" fill="#1A252C" /></> },
};

export function PresetArt({ name, size = 40 }) {
  const preset = PRESETS[name] || PRESETS.comet;
  const id = `av-${name}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0 rounded-full">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={preset.bg[0]} />
          <stop offset="1" stopColor={preset.bg[1]} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill={`url(#${id})`} />
      {preset.draw}
    </svg>
  );
}

export default function Avatar({ user, size = 32 }) {
  const avatar = user?.avatar || "";
  if (avatar.startsWith("data:image/")) {
    return <img src={avatar} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  if (avatar.startsWith("preset:")) return <PresetArt name={avatar.slice(7)} size={size} />;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-ink font-semibold text-paper"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {(user?.display_name || user?.email || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Crop to a centred square, resize to 256px and encode small enough to store. */
// eslint-disable-next-line react-refresh/only-export-components
export async function imageToAvatar(file) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  canvas.getContext("2d").drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  for (const q of [0.85, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/webp", q);
    if (url.length < 140000) return url.startsWith("data:image/webp") ? url : canvas.toDataURL("image/jpeg", q);
  }
  throw new Error("That image is too detailed to use. Try a smaller one.");
}
