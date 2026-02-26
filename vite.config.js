import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    // Polyfill Node.js globals (Buffer, process, etc.) needed by @perawallet/connect + algosdk
    nodePolyfills({ include: ['buffer', 'process', 'stream', 'util', 'events'] }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ['@perawallet/connect', 'algosdk'],
  },
})
