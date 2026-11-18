import { useState } from "react";
import { Tiles } from "./Pick";
import Slider from "./Slider";

/** Presets as tiles, plus "Custom" that opens a slider over the full range. */
export default function RuleChooser({ rule, value, onChange, size = "md", columns }) {
  const isPreset = rule.options.some((o) => o.value === value);
  const [custom, setCustom] = useState(!isPreset);
  const first = rule.custom.stops.includes(value) ? value : rule.custom.stops[Math.floor(rule.custom.stops.length / 4)];
  return (
    <div className="space-y-4">
      <Tiles
        size={size}
        columns={columns || "grid-cols-2 sm:grid-cols-5"}
        label={rule.question}
        value={custom ? "__custom" : value}
        onChange={(v) => {
          if (v === "__custom") {
            setCustom(true);
            onChange(first);
          } else {
            setCustom(false);
            onChange(v);
          }
        }}
        options={[...rule.options, { value: "__custom", label: "Custom", hint: "Set your own" }]}
      />
      {custom && (
        <div className="sheet-in rounded-sheet border border-rule bg-sheet px-5 py-4">
          <Slider label={rule.question} stops={rule.custom.stops} value={first} onChange={onChange} format={rule.custom.format} />
        </div>
      )}
    </div>
  );
}
