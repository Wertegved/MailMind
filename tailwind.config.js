/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#F4F5F8',
        surface: '#FFFFFF',
        ink: { DEFAULT: '#1A1D2E', soft: '#3D4157', muted: '#666B82', faint: '#626879' },
        line: { DEFAULT: '#E4E6EE', strong: '#CDD0DD' },
        brand: { DEFAULT: '#3F4FE0', soft: '#ECEEFD', deep: '#2B38B5' },
        client: { DEFAULT: '#C42B6B', soft: '#FCEAF2' },
        quiet: { DEFAULT: '#5B6478', soft: '#EEF0F4' },
        review: { DEFAULT: '#8F5B00', soft: '#FFF4D6', line: '#E2A93B' },
        ok: { DEFAULT: '#16794F', soft: '#E4F5EC' },
      },
      boxShadow: {
        raised: '0 1px 2px rgba(26,29,46,.06), 0 6px 18px -8px rgba(26,29,46,.14)',
      },
    },
  },
  plugins: [],
};
