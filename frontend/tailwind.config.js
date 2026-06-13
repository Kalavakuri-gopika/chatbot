/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        omc: {
          navy: '#0B2545',
          navyLight: '#134074',
          gold: '#D4AF37', // Official Gold
          goldLight: '#F4E0A5',
          amber: '#F4A261', // Mine Amber
          slate: '#1E293B',
          softBg: '#F1F5F9',
          accent: '#0D9488', // Teal accent
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      }
    },
  },
  plugins: [],
}
