import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Proxy /api và /socket.io sang backend (mặc định cổng 4000) khi chạy dev.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:4000'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/socket.io': { target: API_TARGET, changeOrigin: true, ws: true },
    },
  },
})
