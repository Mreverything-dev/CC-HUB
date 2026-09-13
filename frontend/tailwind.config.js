// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html",
  ],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        accent: '#00d4ff',
        'accent-secondary': '#0099cc',
        danger: '#ef4444',
        glass: 'rgb(var(--color-glass) / <alpha-value>)',
        'glass-hover': 'rgb(var(--color-glass-hover) / <alpha-value>)',
      },
      boxShadow: {
        'glow-accent-sm': '0 0 20px rgba(0, 212, 255, 0.15)',
        'glow-accent-lg': '0 0 40px rgba(0, 212, 255, 0.25)',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
        },
        '.scrollbar-default': {
          '&::-webkit-scrollbar': {
            display: 'block',
          },
          '-ms-overflow-style': 'auto',
          'scrollbar-width': 'auto',
        },
      });
    },
  ],
};