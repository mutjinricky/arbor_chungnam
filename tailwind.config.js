/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f1f7f2',
          100: '#dceadf',
          200: '#b9d4bf',
          300: '#8fb89a',
          400: '#5f9b70',
          500: '#3f7f54',
          600: '#2f6541',
          700: '#264f34',
          800: '#1f3f2b',
          900: '#172e20'
        },
        gov: {
          50: '#f4f7fb',
          100: '#e6edf6',
          200: '#cad8ea',
          300: '#9eb7d6',
          400: '#6d90bc',
          500: '#4a70a3',
          600: '#385988',
          700: '#2d486e',
          800: '#243a58',
          900: '#1c2c43'
        }
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '"Noto Sans KR"',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif'
        ]
      }
    }
  },
  plugins: []
}
