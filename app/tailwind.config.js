/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Dynamic theme colors — resolved at runtime via CSS custom properties.
        // The `var(--color-xxx, fallback)` pattern means Tailwind classes like
        // `bg-background` or `text-accent` automatically pick up whatever value
        // the root layout sets via NativeWind's `vars` prop. The fallback is the
        // dark-mode default so things look right before hydration.
        background: "var(--color-background, #0F0F0F)",
        surface: "var(--color-surface, #1A1A1A)",
        border: "var(--color-border, #2A2A2A)",
        accent: "var(--color-accent, #E8FF47)",
        foreground: "var(--color-foreground, #FFFFFF)",
        // Muted is the same in both themes, so no CSS variable needed.
        muted: "#6B7280",
      },
    },
  },
  plugins: [],
};
