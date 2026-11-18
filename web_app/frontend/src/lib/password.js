// Password rules shown to people; the server enforces the same ones.
export const PASSWORD_RULES = [
  { label: "At least 10 characters", test: (p) => p.length >= 10 },
  { label: "An uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "A number", test: (p) => /\d/.test(p) },
  { label: "A symbol, like ! or #", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export const passwordReady = (p) => PASSWORD_RULES.every((r) => r.test(p));

/** Map server password errors onto the checklist's final line. */
export function serverIssueFrom(message = "") {
  const m = message.toLowerCase();
  if (m.includes("breach")) return "breached";
  if (m.includes("common")) return "common";
  if (m.includes("similar")) return "similar";
  return null;
}
