// Shared wording for trade plans: horizons, convictions, targets and stops.
export const HORIZON_STOPS = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90];
export const CONVICTION_STOPS = [50, 60, 70, 80, 90];
export const TARGET_STOPS = [null, 5, 10, 15, 20, 25, 35, 50, 75, 100, 150, 200];
export const STOP_STOPS = [null, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50];

export function horizonLabel(d) {
  if (d === 1) return "Tomorrow";
  if (d === 7) return "In a week";
  if (d === 30) return "In a month";
  if (d % 30 === 0) return `In ${d / 30} months`;
  if (d % 7 === 0) return `In ${d / 7} weeks`;
  if (d === 45) return "In 6 weeks";
  return `In ${d} days`;
}

/** "by tomorrow", "within 2 weeks": for sentences. */
export function horizonPhrase(d) {
  if (!d) return "";
  if (d === 1) return "by tomorrow";
  return `within ${horizonLabel(d).slice(3)}`;
}

export const CONVICTION_WORDS = { 50: "A coin flip", 60: "Leaning yes", 70: "Fairly sure", 80: "Confident", 90: "Very sure" };
