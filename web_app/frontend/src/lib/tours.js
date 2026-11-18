// A short guided walk through each page, shown the first time you open it.
export const TOURS = {
  market: [
    { target: "floor", title: "The market right now", body: "The coin drawing the most attention, and why. Hype is worth understanding before you act on it." },
    { target: "heat", title: "Heat", body: "How far a coin's price, volume and news are running ahead of its normal. Hot coins get a short pause before you can buy." },
    { target: "wire", title: "News, linked to coins", body: "Headlines are tagged with the coins they mention. Tap one to see the coin." },
  ],
  coin: [
    { target: "price", title: "Live price", body: "Ticks in real time from Coinbase. Your trades fill against its live order book." },
    { target: "trade", title: "Trade with a plan", body: "Each buy asks for your reason, a time frame and how sure you are. We check the call when the time is up." },
    { target: "moving", title: "What's moving it", body: "Plain-language reasons this coin is quiet, warm or hot today." },
  ],
  portfolio: [
    { target: "value", title: "Your practice money", body: "Everything is measured against simply holding Bitcoin since you started. Beating that is harder than it looks." },
    { target: "today", title: "Your rules at work", body: "Trades left today, and when buying pauses. Change your rules in settings." },
  ],
  journal: [
    { target: "page", title: "Every decision, written down", body: "Trades land here with the reason you gave. Nothing can be erased, so you can see how your thinking held up." },
    { target: "note", title: "Add what you learn", body: "Come back after a trade plays out and write a line to your future self." },
  ],
  progress: [
    { target: "milestones", title: "Milestones", body: "Small habits worth building, from writing reasons to planning exits." },
    { target: "judgment", title: "How good is your confidence?", body: "When you say 80% sure, are you right 80% of the time? Your calls appear here as they're checked." },
    { target: "habits", title: "Patterns", body: "How you do buying into hype, right after a loss, and by mood. Sections unlock as you trade." },
  ],
};

const key = (user, id) => `tour:${user}:${id}`;
export function tourSeen(user, id) {
  try {
    return localStorage.getItem(key(user, id)) === "1";
  } catch {
    return true;
  }
}
export function markTourSeen(user, id) {
  try {
    localStorage.setItem(key(user, id), "1");
  } catch {
    /* storage unavailable: the tour simply shows again */
  }
}
export function resetTours(user) {
  try {
    Object.keys(TOURS).forEach((id) => localStorage.removeItem(key(user, id)));
  } catch {
    /* ignore */
  }
}
