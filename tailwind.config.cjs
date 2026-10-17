/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{tsx,ts,jsx,js}',
  ],
  theme: {
    extend: {},
  },
  corePlugins: {
    preflight: false, // we use our own base styles
  },
  plugins: [],
}
