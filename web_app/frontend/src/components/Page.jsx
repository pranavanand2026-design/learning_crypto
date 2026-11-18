/** Consistent page heading: title, one supporting line, optional aside. */
export function PageHeader({ title, sub, aside }) {
  return (
    <header className="flex flex-col gap-3 border-b border-rule pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-light tracking-tight">{title}</h1>
        {sub && <p className="mt-2 max-w-xl text-graphite">{sub}</p>}
      </div>
      {aside && <div className="text-sm text-graphite">{aside}</div>}
    </header>
  );
}

/** A titled band of the page; children usually sit on cards. */
export function Band({ title, sub, children, tour }) {
  return (
    <section data-tour={tour} className="scroll-mt-24">
      <div className="mb-5">
        <h2 className="text-xl font-medium tracking-tight">{title}</h2>
        {sub && <p className="mt-1 text-sm text-graphite">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }) {
  return <div className={`rounded-sheet border border-rule/70 bg-sheet p-6 md:p-7 ${className}`}>{children}</div>;
}
