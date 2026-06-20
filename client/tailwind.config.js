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
        // Đá rơi từ trên xuống trúng đầu nhân vật rồi nảy + biến mất.
        rockdrop: {
          '0%': { transform: 'translateY(-190px) rotate(0deg)', opacity: '0' },
          '18%': { opacity: '1' },
          '68%': { transform: 'translateY(0) rotate(160deg)', opacity: '1' },
          '80%': { transform: 'translateY(-7px) rotate(180deg)' },
          '100%': { transform: 'translateY(2px) rotate(200deg)', opacity: '0' },
        },
        // Bị đá nện: khựng xuống + lắc qua lại.
        bonk: {
          '0%,62%': { transform: 'translateY(0) translateX(0) scaleY(1)' },
          '70%': { transform: 'translateY(7px) translateX(-3px) scaleY(0.85)' },
          '78%': { transform: 'translateY(2px) translateX(3px) scaleY(1)' },
          '86%': { transform: 'translateY(0) translateX(-2px)' },
          '100%': { transform: 'translateY(0) translateX(0)' },
        },
        // Trả lời đúng: nhảy bật lên một bậc.
        hop: {
          '0%': { transform: 'translateY(0)' },
          '35%': { transform: 'translateY(-16px)' },
          '60%': { transform: 'translateY(0)' },
          '74%': { transform: 'translateY(-6px)' },
          '100%': { transform: 'translateY(0)' },
        },
        // Sao bay quanh đầu khi bị nện.
        twinkle: {
          '0%': { transform: 'scale(0) rotate(0deg)', opacity: '0' },
          '35%': { transform: 'scale(1.15) rotate(40deg)', opacity: '1' },
          '100%': { transform: 'scale(0.5) rotate(120deg)', opacity: '0' },
        },
        // Mây trôi nhẹ + nắng lung linh.
        drift: {
          '0%,100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(10px)' },
        },
        // Nhân vật đứng yên thở/nhún nhẹ.
        idlebob: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6%)' },
        },
        // Cổng "?" phát quầng sáng phập phồng.
        gateglow: {
          '0%,100%': { opacity: '0.4', transform: 'scale(0.9)' },
          '50%': { opacity: '0.85', transform: 'scale(1.08)' },
        },
        // Kho báu toả hào quang.
        treasureaura: {
          '0%,100%': { opacity: '0.45', transform: 'scale(0.88)' },
          '50%': { opacity: '0.95', transform: 'scale(1.14)' },
        },
        // Tia sáng lấp lánh.
        sparkle: {
          '0%': { transform: 'scale(0) rotate(0deg)', opacity: '0' },
          '50%': { transform: 'scale(1) rotate(90deg)', opacity: '1' },
          '100%': { transform: 'scale(0) rotate(180deg)', opacity: '0' },
        },
        // Đom đóm/bụi trôi lơ lửng tạo không khí hang động.
        mote: {
          '0%': { transform: 'translateY(6px) translateX(0)', opacity: '0' },
          '20%,80%': { opacity: '0.7' },
          '100%': { transform: 'translateY(-30px) translateX(10px)', opacity: '0' },
        },
        // Vòng sáng loang ra khi trả lời đúng / về đích.
        ripple: {
          '0%': { transform: 'scale(0.3)', opacity: '0.75' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        // Bụi tung lên khi bị đá nện.
        dust: {
          '0%': { transform: 'scale(0.4) translateY(0)', opacity: '0.85' },
          '100%': { transform: 'scale(1.7) translateY(6px)', opacity: '0' },
        },
        // Lắc nhẹ cả khung khi trả lời sai (rung "màn hình").
        boardshake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-5px) rotate(-0.4deg)' },
          '40%': { transform: 'translateX(5px) rotate(0.4deg)' },
          '60%': { transform: 'translateX(-3px)' },
          '80%': { transform: 'translateX(3px)' },
        },
      },
      animation: {
        pop: 'pop 0.25s ease-out',
        shake: 'shake 0.3s ease-in-out',
        floatup: 'floatup 0.9s ease-out forwards',
        rockdrop: 'rockdrop 0.85s ease-in forwards',
        bonk: 'bonk 0.85s ease-out',
        hop: 'hop 0.6s ease-out',
        twinkle: 'twinkle 0.85s ease-out forwards',
        drift: 'drift 6s ease-in-out infinite',
        idlebob: 'idlebob 2.4s ease-in-out infinite',
        gateglow: 'gateglow 1.8s ease-in-out infinite',
        treasureaura: 'treasureaura 2s ease-in-out infinite',
        sparkle: 'sparkle 1.4s ease-in-out infinite',
        mote: 'mote 5s ease-in-out infinite',
        ripple: 'ripple 0.7s ease-out forwards',
        dust: 'dust 0.6s ease-out forwards',
        boardshake: 'boardshake 0.5s ease-in-out',
      },
    },
  },
  plugins: [],
}
