import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward API calls to the Vercel dev server (run `vercel dev` on port 3000)
      '/api': 'http://localhost:3000',
    },
  },
})
