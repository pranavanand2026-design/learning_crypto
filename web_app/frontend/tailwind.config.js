/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      paper: token("paper"),
      sheet: token("sheet"),
      ink: token("ink"),
      graphite: token("graphite"),
      rule: token("rule"),
      marker: token("marker"),
      "on-marker": token("on-marker"),
      accent: token("accent"),
      "on-accent": token("on-accent"),
      "accent-hi": token("accent-hi"),
      warm: token("warm"),
      gain: token("gain"),
      loss: token("loss"),
      floor: token("floor"),
      brand: token("brand"),
      "on-floor": token("on-floor"),
      "gain-hi": token("gain-hi"),
      "loss-hi": token("loss-hi"),
      white: "#fff",
    },
    fontFamily: {
      sans: ['"Geist Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
      serif: ['"Newsreader Variable"', "ui-serif", "Georgia", "serif"],
    },
    fontSize: {
      xs: ["0.8125rem", { lineHeight: "1.15rem" }],   // 13
      sm: ["0.875rem", { lineHeight: "1.3rem" }],     // 14
      base: ["0.9375rem", { lineHeight: "1.45rem" }], // 15
      md: ["1.1875rem", { lineHeight: "1.6rem" }],    // 19
      lg: ["1.5rem", { lineHeight: "1.9rem" }],       // 24
      xl: ["1.875rem", { lineHeight: "2.2rem" }],     // 30
      "2xl": ["2.375rem", { lineHeight: "2.6rem" }],  // 38
      "3xl": ["3rem", { lineHeight: "3.1rem" }],      // 48
      "4xl": ["3.75rem", { lineHeight: "3.8rem" }],   // 60
    },
    extend: {
      borderRadius: { chip: "999px", sheet: "14px", field: "8px" },
      maxWidth: { page: "76rem" },
      transitionTimingFunction: { out: "cubic-bezier(.2,.8,.2,1)" },
    },
  },
  plugins: [],
};
