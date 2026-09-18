/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: {
            50: '#f0fdfa',
            100: '#ccfbf1',
            200: '#99f6e4',
            300: '#5eead4',
            400: '#2dd4bf',
            500: '#14b8a6',
            600: '#0d9488',
            700: '#0f766e',
            800: '#115e59',
            900: '#134e4a',
          },
          mint: {
            50: '#f4fbf9',
            100: '#e6f7f3',
            200: '#c5efe4',
            300: '#9fe3d1',
          },
          slate: {
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            600: '#475569',
            700: '#334155',
            800: '#1e293b',
            900: '#0f172a',
          }
        },
        signal: {
          verified: {
            text: '#15803d',
            bg: '#f0fdf4',
            border: '#bbf7d0',
          },
          review: {
            text: '#b45309',
            bg: '#fffbeb',
            border: '#fde68a',
          },
          duplicate: {
            text: '#b91c1c',
            bg: '#fef2f2',
            border: '#fecaca',
          },
          info: {
            text: '#0369a1',
            bg: '#f0f9ff',
            border: '#bae6fd',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'civic-sm': '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        'civic': '0 2px 4px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
        'civic-md': '0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
        'civic-lg': '0 10px 15px -3px rgba(15, 23, 42, 0.07), 0 4px 6px -4px rgba(15, 23, 42, 0.04)',
      }
    },
  },
  plugins: [],
}
