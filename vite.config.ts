import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Quan trọng: Đặt đường dẫn cơ sở là tương đối để chạy đúng trên GitHub Pages
  build: {
    outDir: 'dist',
  },
})