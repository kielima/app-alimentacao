/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f8ed',
          100: '#e9efd6',
          200: '#d3dfaf',
          300: '#b6c87d',
          400: '#9bb054',
          500: '#6b8e23',
          600: '#587628',
          700: '#445b22',
          800: '#384a20',
          900: '#30401f',
        },
      },
    },
  },
  plugins: [],
};
