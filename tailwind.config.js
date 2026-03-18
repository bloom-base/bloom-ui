/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Semantic design tokens ────────────────────────────────────────
        // Using space-separated RGB so Tailwind opacity modifiers work,
        // e.g. bg-canvas/80, text-ink/60
        //
        // Backgrounds
        canvas: {
          DEFAULT: 'rgb(var(--color-bg) / <alpha-value>)',
          subtle:  'rgb(var(--color-bg-subtle) / <alpha-value>)',
          muted:   'rgb(var(--color-bg-muted) / <alpha-value>)',
        },
        // Surfaces (cards, panels, modals)
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          raised:  'rgb(var(--color-surface-raised) / <alpha-value>)',
        },
        // Borders
        line: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          subtle:  'rgb(var(--color-border-subtle) / <alpha-value>)',
        },
        // Text
        ink: {
          DEFAULT:   'rgb(var(--color-text) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          tertiary:  'rgb(var(--color-text-tertiary) / <alpha-value>)',
        },
        // Accent (violet — semantic, adapts in dark mode)
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          hover:   'rgb(var(--color-accent-hover) / <alpha-value>)',
          subtle:  'rgb(var(--color-accent-subtle) / <alpha-value>)',
          // Fixed values (for cases that don't need to adapt)
          fixed:        '#8b5cf6',
          'fixed-hover': '#7c3aed',
          'fixed-subtle': '#ede9fe',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
