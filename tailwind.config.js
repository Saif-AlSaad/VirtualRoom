/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand palette — coolors.co/dad7cd-a3b18a-588157-3a5a40-344e41
        sage: {
          50: '#f4f3ee',
          100: '#dad7cd',
          200: '#c3c2b0',
          300: '#a3b18a',
          400: '#7d9468',
          500: '#588157',
          600: '#47694a',
          700: '#3a5a40',
          800: '#344e41',
          900: '#26382f',
        },
        // 5-step neutral scale (borders / secondary text)
        ink: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#101013',
        },
        danger: '#ef4444',
        warn: '#f59e0b',
        ok: '#10b981',
        // Premium Dark Studio palette
        studio: {
          bg: '#101211',
          sidebar: '#141815',
          card: '#191D1A',
          elevated: '#222823',
          hover: '#292F2A',
          accent: '#83B493',
          'accent-hover': '#9BC8A8',
          'accent-muted': '#344C3B',
          text: '#F3F5F2',
          'text-muted': '#A4AEA6',
          'text-dim': '#778179',
          border: '#2C332E',
          divider: '#252B26',
          danger: '#E57373',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Type scale from the design system: caption / body / section / title
        caption: ['12px', { lineHeight: '16px' }],
        body: ['14px', { lineHeight: '20px' }],
        section: ['16px', { lineHeight: '24px' }],
        title: ['20px', { lineHeight: '28px' }],
      },
      borderRadius: {
        control: '6px', // buttons, inputs
        panel: '12px', // cards, panels
        modal: '16px', // modals
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(16,16,19,0.06), 0 1px 3px rgba(16,16,19,0.04)',
        medium: '0 4px 12px rgba(16,16,19,0.10), 0 2px 4px rgba(16,16,19,0.06)',
        high: '0 16px 48px rgba(16,16,19,0.18), 0 4px 12px rgba(16,16,19,0.08)',
      },
      transitionDuration: { 150: '150ms', 200: '200ms' },
      keyframes: {
        'pulse-once': {
          '0%': { opacity: '0.9', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(1.03)' },
          '100%': { opacity: '0', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'pulse-once': 'pulse-once 400ms ease-out forwards',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};
