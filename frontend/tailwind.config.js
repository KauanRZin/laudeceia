/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1A4DA2",
        secondary: "#4A90D9",
        appBg: "#F4F6F9",
        surface: "#FFFFFF",
        textPrimary: "#1C1C1E",
        textSecondary: "#6B7280",
        borderSoft: "#D1D5DB",
        danger: "#DC2626",
        success: "#16A34A",
        warning: "#D97706",
        inactive: "#9CA3AF",
        employee: "#245B5A"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"]
      },
      boxShadow: {
        card: "0 1px 4px rgba(0,0,0,0.08)"
      }
    },
  },
  plugins: [],
};
