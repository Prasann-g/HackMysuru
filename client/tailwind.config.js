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
        },
        bridge: {
          ivory: {
            50: '#FAF8F5',
            100: '#F5F2EB',
            200: '#ECE7DC',
            300: '#DFD8CA',
            400: '#D1C7B5',
            500: '#C2B59F',
          },
          almond: {
            50: '#FAF6F0',
            100: '#F4EFE6',
            200: '#EAE2D5',
            300: '#DED3C4',
            400: '#CFC0AD',
            500: '#BEAA94',
            600: '#A9947D',
            700: '#8A7662',
            800: '#695847',
            900: '#483C30',
          },
          gold: {
            50: '#FDFBF7',
            100: '#FBF5E8',
            200: '#F5E8CB',
            300: '#E8D09B',
            400: '#D9B96E',
            500: '#C5A059',
            600: '#B08C44',
            700: '#8E6E31',
            800: '#6E5423',
            900: '#4F3B16',
          },
          charcoal: {
            50: '#F6F7F8',
            100: '#EBECEE',
            200: '#D5D7DC',
            300: '#B4B8C1',
            400: '#7E8694',
            500: '#646B7A',
            600: '#4A505C',
            700: '#3D424D',
            800: '#2D3139',
            900: '#1C1E21',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'civic-sm': '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        'civic': '0 2px 4px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
        'civic-md': '0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
        'civic-lg': '0 10px 15px -3px rgba(15, 23, 42, 0.07), 0 4px 6px -4px rgba(15, 23, 42, 0.04)',
        'bridge-sm': '0 1px 2px 0 rgba(28, 30, 33, 0.04)',
        'bridge-card': '0 2px 4px 0 rgba(28, 30, 33, 0.04), 0 1px 2px 0 rgba(28, 30, 33, 0.02)',
        'bridge-modal': '0 12px 32px -4px rgba(28, 30, 33, 0.12), 0 4px 12px -2px rgba(28, 30, 33, 0.06)',
      }
    },
  },
  plugins: [],
}
