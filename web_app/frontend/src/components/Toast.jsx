// frontend/src/components/Toast.jsx
import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Very small toast system using daisyUI classes.
 * Usage:
 *  <ToastProvider>
 *    <App/>
 *  </ToastProvider>
 *  const { showToast } = useToast();
 *  showToast({ text: "Added BTC to watchlist", variant: "success", ms: 2200 });
 */

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]); // [{id, text, variant}]

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({ text, variant = "info", ms = 2000 }) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, text, variant }]);
    // auto-hide
    setTimeout(() => remove(id), ms);
  }, [remove]);

  const api = useMemo(() => ({ showToast, remove }), [showToast, remove]);

  return (
    <ToastCtx.Provider value={api}>
      {children}

      {/* toast container (bottom-right) */}
      <div className="toast toast-end z-50">
        {items.map(({ id, text, variant }) => (
          <div
            key={id}
            className={`alert ${variantToClass(variant)} shadow`}
            role="status"
          >
            <span className="text-sm">{text}</span>
            <button className="btn btn-ghost btn-xs" onClick={() => remove(id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

function variantToClass(variant) {
  switch (variant) {
    case "success": return "alert-success";
    case "error":   return "alert-error";
    case "warning": return "alert-warning";
    default:        return "alert-info";
  }
}