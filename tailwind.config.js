/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#0D0D12',
          surface: '#13131A',
          elevated: '#1A1A26',
          highlight: '#22223A',
          purple: '#7C5CBF',
          'purple-light': '#9B7FD4',
          green: '#2D6A4F',
          'green-light': '#40916C',
          blue: '#1A4A7A',
          'blue-light': '#4A9EDB',
          text: '#F0EEF8',
          muted: '#9090A8',
          coral: '#E57373',
          amber: '#F59E0B',
          gold: '#D4AF37',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '12px',
        xl: '14px',
      },
      maxWidth: {
        mobile: '430px',
      },
    },
  },
  plugins: [],
}
