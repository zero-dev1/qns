import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/rpc': {
        target: 'http://localhost:8545',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc/, ''),
      },
    },
  },
})
