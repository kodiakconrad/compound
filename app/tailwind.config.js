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
        // UI spec: dark minimal palette
        background: "#0F0F0F",
        surface: "#1A1A1A",
        border: "#2A2A2A",
        accent: "#E8FF47",
        muted: "#6B7280",
      },
    },
  },
  plugins: [],
};
