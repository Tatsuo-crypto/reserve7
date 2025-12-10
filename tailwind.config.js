/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        space: {
          black: '#050507',
          DEFAULT: '#0B0B15',
          light: '#1A1A2E',
        },
        nebula: {
          purple: '#7B2CBF',
          blue: '#4CC9F0',
          pink: '#F72585',
          indigo: '#4361EE',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'antigravity-gradient': 'linear-gradient(135deg, #0B0B15 0%, #1A1A2E 100%)',
        'nebula-gradient': 'linear-gradient(to right, #4361EE, #F72585)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
