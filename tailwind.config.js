/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['PlusJakartaSans_400Regular', 'sans-serif'],
        regular: ['PlusJakartaSans_400Regular'],
        medium: ['PlusJakartaSans_500Medium'],
        semibold: ['PlusJakartaSans_600SemiBold'],
        bold: ['PlusJakartaSans_700Bold'],
        extrabold: ['PlusJakartaSans_800ExtraBold'],
      },
      colors: {
        aura: {
          primary: '#2373F4',
          secondary: '#578EF5',
          cyan: '#65D0F4',
          yellow: '#F2F7A0',
          white: '#FFFFFF',
          charcoal: '#363636',
          border: '#578EF5',
          placeholder: '#578EF5',
          divider: '#BFDBFE',
        },
      },
    },
  },
  plugins: [],
};
