/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eaf3fe',
          100: '#d0e4fd',
          200: '#a1c9fb',
          300: '#6fabf6',
          400: '#4098f2',
          500: '#208aef',
          600: '#1a6fc0',
          700: '#155693',
          800: '#103e6b',
          900: '#0b2b4a',
          DEFAULT: '#208aef',
        },
      },
    },
  },
  plugins: [],
};
