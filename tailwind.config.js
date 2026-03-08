/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          DEFAULT: '#00D179',
          hover: '#00B868',
          subtle: 'rgba(0, 209, 121, 0.08)',
        },
        dark: {
          bg: '#0A0A0A',
          surface: '#141414',
          border: '#1E1E1E',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#8A8A8A',
          tertiary: '#555555',
        },
        error: '#E5484D',
        warning: '#F5A623',
      },
      fontFamily: {
        clash: ['Clash Display', 'sans-serif'],
        satoshi: ['Satoshi', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        card: '12px',
      },
      maxWidth: {
        content: '1120px',
        search: '520px',
        register: '480px',
      },
    },
  },
  plugins: [],
}
