import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The interactive Delta page is served as a sub-path of the explainer site:
// https://<user>.github.io/metaheuristics-lab/delta/
export default defineConfig({
  base: '/metaheuristics-lab/delta/',
  plugins: [react(), tailwindcss()],
})
