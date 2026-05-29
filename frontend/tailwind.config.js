/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        brand: { DEFAULT: '#6D28D9', light: '#EDE9FE', dark: '#4C1D95', mid: '#7C3AED' },
      },
      boxShadow: {
        card:  '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        lifted: '0 4px 16px rgba(15,23,42,0.08), 0 1px 4px rgba(15,23,42,0.04)',
        brand: '0 4px 14px rgba(109,40,217,0.30)',
      },
    },
  },
  plugins: [],
}
