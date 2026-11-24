/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: 'rgb(var(--ink-950) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          deep: 'rgb(var(--accent-deep) / <alpha-value>)',
          contrast: 'rgb(var(--accent-contrast) / <alpha-value>)',
        },
        neon: {
          lime: 'rgb(var(--accent) / <alpha-value>)',
          cyan: 'rgb(var(--teal) / <alpha-value>)',
          violet: 'rgb(var(--violet) / <alpha-value>)',
        },
        rarity: {
          common: '#96A3B8',
          rare: '#4D9BFF',
          epic: '#B07CFF',
          legendary: '#F2A54A',
          mythic: '#F06473',
        },
        gold: 'rgb(var(--gold) / <alpha-value>)',
        teal: 'rgb(var(--teal) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Manrope Variable', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk Variable', 'Space Grotesk', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-lime': '0 14px 36px -18px rgba(79,157,255,.55)',
        'neon-violet': '0 14px 36px -18px rgba(176,124,255,.4)',
        card: '0 20px 50px -28px rgba(0,0,0,.72)',
        soft: '0 8px 24px -18px rgba(0,0,0,.7)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        pulseNeon: {
          '0%, 100%': { opacity: '.5' },
          '50%': { opacity: '.85' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.8s linear infinite',
        float: 'float 5s ease-in-out infinite',
        'pulse-neon': 'pulseNeon 3.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
