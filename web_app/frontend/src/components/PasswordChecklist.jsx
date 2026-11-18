import { PASSWORD_RULES } from "../lib/password";

// Live password checklist. Mirrors the server's rules exactly.
function Mark({ state }) {
  // state: "met" | "unmet" | "failed" | "pending"
  if (state === "met") {
    return (
      <span className="grid h-5 w-5 shrink-0 scale-100 place-items-center rounded-full bg-accent text-on-accent transition-transform duration-200">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-loss text-white">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${state === "pending" ? "border-dashed border-graphite/40" : "border-rule"}`} />
  );
}

/**
 * Ticks each rule as it's met. `serverIssue` (e.g. "breached") marks the
 * final check, which only the server can make, as failed.
 */
export default function PasswordChecklist({ password, serverIssue }) {
  const met = PASSWORD_RULES.filter((r) => r.test(password)).length;
  return (
    <div className="mt-3" aria-live="polite">
      <div className="mb-3 flex gap-1" aria-hidden>
        {PASSWORD_RULES.map((_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < met ? (met < 3 ? "bg-loss" : met < 5 ? "bg-warm" : "bg-accent") : "bg-rule"}`} />
        ))}
      </div>
      <ul className="space-y-2 text-sm">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.label} className={`flex items-center gap-2.5 transition-colors ${ok ? "text-ink" : "text-graphite"}`}>
              <Mark state={ok ? "met" : "unmet"} />
              {r.label}
              <span className="sr-only">{ok ? "done" : "not yet"}</span>
            </li>
          );
        })}
        <li className={`flex items-center gap-2.5 ${serverIssue ? "text-loss" : "text-graphite"}`}>
          <Mark state={serverIssue ? "failed" : "pending"} />
          {serverIssue === "breached"
            ? "Found in a data breach. Choose another."
            : serverIssue === "common"
              ? "Too common. Choose something less guessable."
              : serverIssue === "similar"
                ? "Too close to your name or email."
                : "Not a common or leaked password (checked when you continue)"}
        </li>
      </ul>
    </div>
  );
}
