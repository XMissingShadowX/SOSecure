import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'oklch(0.28 0.02 260)',
        input: 'oklch(0.22 0.02 260)',
        ring: 'oklch(0.75 0.15 180)',
        background: 'oklch(0.13 0.01 260)',
        foreground: 'oklch(0.95 0.01 260)',
        primary: {
          DEFAULT: 'oklch(0.75 0.15 180)',
          foreground: 'oklch(0.13 0.01 260)',
        },
        secondary: {
          DEFAULT: 'oklch(0.25 0.02 260)',
          foreground: 'oklch(0.95 0.01 260)',
        },
        destructive: {
          DEFAULT: 'oklch(0.55 0.25 25)',
          foreground: 'oklch(0.98 0.01 0)',
        },
        muted: {
          DEFAULT: 'oklch(0.22 0.02 260)',
          foreground: 'oklch(0.65 0.02 260)',
        },
        accent: {
          DEFAULT: 'oklch(0.25 0.02 260)',
          foreground: 'oklch(0.95 0.01 260)',
        },
        popover: {
          DEFAULT: 'oklch(0.17 0.01 260)',
          foreground: 'oklch(0.95 0.01 260)',
        },
        card: {
          DEFAULT: 'oklch(0.17 0.01 260)',
          foreground: 'oklch(0.95 0.01 260)',
        },
        warning: {
          DEFAULT: 'oklch(0.75 0.18 75)',
          foreground: 'oklch(0.15 0.02 75)',
        },
        safe: {
          DEFAULT: 'oklch(0.65 0.18 145)',
          foreground: 'oklch(0.15 0.02 145)',
        },
      },
      borderRadius: {
        lg: '0.75rem',
        md: 'calc(0.75rem - 2px)',
        sm: 'calc(0.75rem - 4px)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}

export default config
