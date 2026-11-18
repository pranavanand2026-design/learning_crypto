import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TOURS, markTourSeen, tourSeen } from "../lib/tours";
import { useAuth } from "../state/auth";

const PAD = 8;
const CARD_W = 320;

/** Spotlight walkthrough over elements marked with data-tour="…". */
export default function Tour({ id, ready = true }) {
  const { user } = useAuth();
  const [steps, setSteps] = useState(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!user || !ready || tourSeen(user.id, id)) return;
    const t = setTimeout(() => {
      const present = (TOURS[id] || []).filter((s) => document.querySelector(`[data-tour="${s.target}"]`));
      if (present.length) setSteps(present);
    }, 700);
    return () => clearTimeout(t);
  }, [user, id, ready]);

  const step = steps?.[i];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    const t = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, measure]);

  const close = useCallback(() => {
    markTourSeen(user.id, id);
    setSteps(null);
  }, [user, id]);

  useEffect(() => {
    if (!steps) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps, close]);

  if (!steps || !rect) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const below = rect.top + rect.height + 16 + 190 < vh;
  const tall = rect.height > vh * 0.55;
  const cardTop = tall ? Math.min(rect.top + 24, vh - 220) : below ? rect.top + rect.height + 14 : Math.max(rect.top - 14 - 190, 12);
  const width = Math.min(CARD_W, vw - 24);
  const cardLeft = Math.min(Math.max(rect.left, 12), vw - width - 12);
  const lastStep = i === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={step.title}>
      <button className="absolute inset-0 cursor-default" aria-label="Close tour" onClick={close} tabIndex={-1} />
      <div
        className="pointer-events-none absolute rounded-sheet ring-2 ring-marker transition-all duration-300 ease-out"
        style={{ ...rect, boxShadow: "0 0 0 9999px rgb(var(--ink) / 0.45)" }}
      />
      <div
        className="sheet-in absolute rounded-sheet bg-sheet p-5 shadow-[0_18px_48px_rgb(var(--ink)/0.28)]"
        style={{ top: cardTop, left: cardLeft, width }}
      >
        <div className="flex items-center justify-between text-xs text-graphite">
          <span className="num">
            {i + 1} of {steps.length}
          </span>
          <button onClick={close} className="hover:text-ink">
            Skip tour
          </button>
        </div>
        <h2 className="mt-2 text-md font-medium">{step.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-graphite">{step.body}</p>
        <div className="mt-4 flex justify-end gap-2">
          {i > 0 && (
            <button className="btn-quiet !px-4 !py-2" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          <button autoFocus className="btn-ink !px-4 !py-2" onClick={() => (lastStep ? close() : setI(i + 1))}>
            {lastStep ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
