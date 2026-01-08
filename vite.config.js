import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Forzando el reinicio del servidor de desarrollo
  plugins: [react()],
})
