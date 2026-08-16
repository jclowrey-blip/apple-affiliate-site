/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111214",
        paper: "#FAFAF9",
        graphite: "#5B5E63",
        line: "#E4E4E1",
        accent: "#2F6F4E", // deliberate: a muted forest green, distinct from Amazon orange and Apple's own palette
        accentDark: "#20502F",
        warn: "#B3541E",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      maxWidth: {
        content: "72rem",
      },
    },
  },
  plugins: [],
};
