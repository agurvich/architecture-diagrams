import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built output works when served from a
  // GitHub Pages project subpath (e.g. /architecture-diagrams/) without
  // hardcoding the repo name.
  base: './',
})
