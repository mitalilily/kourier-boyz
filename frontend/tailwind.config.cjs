/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)', // main brand yellow
          light: 'var(--color-primary-light)',
          dark: 'var(--color-primary-dark)',
          hover: 'var(--color-primary-hover)',
          border: 'var(--color-primary-border)',
        },
        blue: {
          DEFAULT: 'var(--color-blue)', // primary blue #1353A4
          light: 'var(--color-blue-light)',
          dark: 'var(--color-blue-dark)',
          hover: 'var(--color-blue-hover)',
        },
        yellow: {
          DEFAULT: 'var(--color-yellow)', // primary yellow #FED300
          light: 'var(--color-yellow-light)',
          dark: 'var(--color-yellow-dark)',
          hover: 'var(--color-yellow-hover)',
        },
      },
      borderRadius: {
        none: '0px',
        sm: '0.125rem', // 2px
        DEFAULT: '0.25rem', // 4px
        md: '0.375rem', // 6px
        lg: '0.5rem', // 8px
        xl: '0.75rem', // 12px
        '2xl': '1rem', // 16px
        '3xl': '1.5rem', // 24px
        full: '9999px',
      },
    },
  },
  plugins: [],
}
