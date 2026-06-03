/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE',
          400: '#818CF8', 500: '#6366F1', 600: '#4F46E5',
          700: '#4338CA', 800: '#3730A3', 900: '#312E81',
        },
        'warm-white': '#fafaf8',
        'pastel-green': '#dcfce7',
        'pastel-amber': '#fef3c7',
        'pastel-red': '#fee2e2',
        'pastel-violet': '#ede9fe',
      },
      keyframes: {
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(100px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        slideInRight: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
