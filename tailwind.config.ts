import type { Config } from 'tailwindcss'

const config: Config = {
  // Diese Zeile verhindert, dass Tailwind die Systemeinstellung (Dark Mode) automatisch übernimmt
  darkMode: 'class', 
  
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography'), // ✅ Hier das Plugin einfügen
  ],
}
export default config
