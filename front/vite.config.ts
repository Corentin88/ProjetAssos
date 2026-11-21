import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// MAQUETTE_HOST_BASE : préfixe d'hébergement utilisé uniquement pour la
// prévisualisation intégrée (ex. /maquette/). En local : `npm run dev` → base '/'
const base = process.env.MAQUETTE_HOST_BASE || '/'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base,
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
