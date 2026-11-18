export function Loading({ label = "Loading", className = "" }) {
  return (
    <div className={`flex items-center gap-3 py-16 text-sm text-graphite ${className}`} role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-rule border-t-ink" />
      {label}
    </div>
  );
}

export function Problem({ error, onRetry }) {
  const offline = error?.status === 503;
  return (
    <div className="py-16 text-sm" role="alert">
      <p>{offline ? "Market data is unavailable right now." : error?.message || "Something went wrong."}</p>
      {onRetry && (
        <button onClick={onRetry} className="link mt-2 text-graphite">
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="py-16">
      <p className="text-md">{title}</p>
      {children && <div className="mt-2 text-sm text-graphite">{children}</div>}
    </div>
  );
}
