/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "360px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
      spacing: {
        "safe-top": "max(env(safe-area-inset-top), 0rem)",
        "safe-bottom": "max(env(safe-area-inset-bottom), 0rem)",
        "safe-left": "max(env(safe-area-inset-left), 0rem)",
        "safe-right": "max(env(safe-area-inset-right), 0rem)",
      },
    },
  },
  plugins: [],
};
