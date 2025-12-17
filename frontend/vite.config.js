import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/compile': 'http://localhost:5050',
      '/chat': 'http://localhost:5050',
      '/history': 'http://localhost:5050',
      '/output': 'http://localhost:5050',
      '/pdf': 'http://localhost:5050',
      '/get_template': 'http://localhost:5050',
      '/synctex': 'http://localhost:5050',
    }
  },
  build: {
    outDir: '../static/react',
    emptyOutDir: true
  }
})
