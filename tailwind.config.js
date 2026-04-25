/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        ember: "#f97316",
        gold: "#facc15",
        mist: "#e2e8f0",
      },
      boxShadow: {
        glow: "0 20px 80px rgba(249, 115, 22, 0.25)",
      },
    },
  },
  plugins: [],
};
