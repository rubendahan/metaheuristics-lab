import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The interactive Delta page is served as a sub-path of the explainer site:
// https://<user>.github.io/without-a-gradient/delta/
export default defineConfig({
  base: '/without-a-gradient/delta/',
  plugins: [react(), tailwindcss()],
})
