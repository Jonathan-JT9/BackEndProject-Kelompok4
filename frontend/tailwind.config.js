/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        unklab: {
          gold: "#F2B705",
          navy: "#0A1F44",
          light: "#FFF9E8",
        },
      },
    },
  },
  plugins: [],
}

