/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        treasure: {
          bg: '#1b2a1f',
          panel: '#243a2a',
          wood: '#7a4f2a',
          woodlt: '#a8703f',
          gold: '#f4c542',
          gem: '#46c6ff',
          danger: '#e2553d',
        },
      },
      fontFamily: {
        display: ['"Baloo 2"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.7)', opacity: '0' },
          '70%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' },
        },
        floatup: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-40px)', opacity: '0' },
        },
      },
      animation: {
        pop: 'pop 0.25s ease-out',
        shake: 'shake 0.3s ease-in-out',
        floatup: 'floatup 0.9s ease-out forwards',
      },
    },
  },
  plugins: [],
}
