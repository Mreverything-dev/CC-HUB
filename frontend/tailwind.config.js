// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        'text-primary': '#ffffff',
        'text-secondary': '#a0a0a0',
        'text-muted': '#6b6b6b',
        accent: '#00d4ff',
        'accent-secondary': '#0099cc',
        border: '#2a2a2a',
        danger: '#ef4444',
        glass: 'rgba(255, 255, 255, 0.05)',
        'glass-hover': 'rgba(255, 255, 255, 0.08)',
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
          /* Hide scrollbar for Chrome, Safari and Opera */
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          /* Hide scrollbar for IE, Edge and Firefox */
          '-ms-overflow-style': 'none',  /* IE and Edge */
          'scrollbar-width': 'none',  /* Firefox */
        },
        '.scrollbar-default': {
          /* Show scrollbar for Chrome, Safari and Opera */
          '&::-webkit-scrollbar': {
            display: 'block',
          },
          /* Show scrollbar for IE, Edge and Firefox */
          '-ms-overflow-style': 'auto',  /* IE and Edge */
          'scrollbar-width': 'auto',  /* Firefox */
        },
      });
    },
  ],
};