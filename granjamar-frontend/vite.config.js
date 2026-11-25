import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Escucha en toda la red (no solo en localhost) para que otras PCs de la oficina puedan entrar.
  server: { host: true, port: 5173 },
  preview: { host: true, port: 5173 },
})