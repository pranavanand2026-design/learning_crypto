import { useEffect, useRef, useState } from "react";
import { money } from "../lib/format";

/** A price that washes with highlighter when it changes. */
export default function LivePrice({ value, className = "", digits }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (prev.current !== undefined && value !== prev.current) setFlash((f) => f + 1);
    prev.current = value;
  }, [value]);
  return (
    <span key={flash} className={`num ${flash ? "tick" : ""} ${className}`}>
      {money(value, { digits })}
    </span>
  );
}
