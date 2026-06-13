/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{svelte,js,html}'],
  darkMode: 'class',
  // Classes built via template literals (e.g. `bg-rarity-${rarity}-bg`) aren't
  // detected by the content scanner, so we safelist every rarity × property combo
  // used by Inventory.svelte's `rarityClass()` helper.
  safelist: [
    {
      pattern: /^(bg|text)-rarity-(junk|basic|fine|masterwork|rare|exotic|ascended|legendary)-(bg|fg)$/,
    },
  ],
  theme: {
    extend: {
      colors: {
        // shadcn-svelte base tokens (driven by CSS variables)
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        // GW2-specific colors
        brand: {
          DEFAULT: '#d2691e',
          hover: '#b85e0c',
          light: '#fde4c8',
          dark: '#e8824a',
        },
        gold: {
          DEFAULT: '#b85e0c',
          dark: '#f0a040',
        },
        rarity: {
          junk:      { bg: '#aaaaaa', fg: '#333333' },
          basic:     { bg: '#888888', fg: '#ffffff' },
          fine:      { bg: '#62a4da', fg: '#ffffff' },
          masterwork:{ bg: '#3ad93a', fg: '#ffffff' },
          rare:      { bg: '#fcd432', fg: '#333333' },
          exotic:    { bg: '#fbaa34', fg: '#ffffff' },
          ascended:  { bg: '#fb4e6e', fg: '#ffffff' },
          legendary: { bg: '#9c6adb', fg: '#ffffff' },
        },
        profession: {
          guardian:    '#7ab3cf',
          warrior:     '#fcd432',
          engineer:    '#b06b3c',
          ranger:      '#8cd43c',
          thief:       '#c08e7c',
          elementalist:'#f68a6c',
          mesmer:      '#b57dc8',
          necromancer: '#5ba35b',
          revenant:    '#d2691e',
        },
        action: {
          sell:    { bg: '#d4edda', fg: '#155724' },
          salvage: { bg: '#fff3cd', fg: '#856404' },
          keep:    { bg: '#cce5ff', fg: '#004085' },
          use:     { bg: '#e2d9f3', fg: '#3d2b63' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
