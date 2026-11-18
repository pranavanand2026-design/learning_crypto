// The four personal rules: friendly presets plus a custom range for each.
const range = (lo, hi, step) => Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

export const RULE_QUESTIONS = [
  {
    key: "max_trades_per_day",
    question: "How many trades a day, at most?",
    hint: "Fewer, better-planned trades beat many quick ones.",
    options: [
      { value: 3, label: "3", hint: "Deliberate" },
      { value: 5, label: "5", hint: "Steady" },
      { value: 8, label: "8", hint: "Active" },
      { value: null, label: "No cap", hint: "Up to you" },
    ],
    custom: { stops: range(1, 30, 1), format: (v) => `${v} trade${v === 1 ? "" : "s"}` },
    summary: (v) => (v ? `${v} trades a day` : "No daily cap"),
  },
  {
    key: "max_daily_loss_pct",
    question: "If a day goes badly, when do you stop?",
    hint: "Losing this much of your starting cash ends buying for the day.",
    options: [
      { value: 2, label: "2%", hint: "Cautious" },
      { value: 5, label: "5%", hint: "Balanced" },
      { value: 10, label: "10%", hint: "Bold" },
      { value: null, label: "Never", hint: "No limit" },
    ],
    custom: { stops: range(1, 50, 1), format: (v) => `${v}% in a day` },
    summary: (v) => (v ? `Stop after losing ${v}% in a day` : "No daily loss limit"),
  },
  {
    key: "cooldown_minutes",
    question: "After selling at a loss, take a breather?",
    hint: "A pause keeps one bad trade from turning into three.",
    options: [
      { value: 0, label: "No pause" },
      { value: 5, label: "5 min" },
      { value: 15, label: "15 min" },
      { value: 30, label: "30 min" },
    ],
    custom: { stops: range(0, 120, 5), format: (v) => (v ? `${v} minutes` : "No pause") },
    summary: (v) => (v ? `${v} minute pause after a loss` : "No pause after a loss"),
  },
  {
    key: "max_position_pct",
    question: "How much could one coin be of your portfolio?",
    hint: "We'll flag any buy that goes over it.",
    options: [
      { value: 10, label: "10%", hint: "Spread out" },
      { value: 25, label: "25%", hint: "Focused" },
      { value: 50, label: "50%", hint: "Concentrated" },
      { value: null, label: "Any", hint: "No limit" },
    ],
    custom: { stops: range(5, 100, 5), format: (v) => `${v}% in one coin` },
    summary: (v) => (v ? `At most ${v}% in one coin` : "No position limit"),
  },
];

export const DEFAULT_RULES = { max_trades_per_day: 5, max_daily_loss_pct: 5, cooldown_minutes: 15, max_position_pct: 25 };
