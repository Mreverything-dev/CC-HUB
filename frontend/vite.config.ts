import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';  // Use named import

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),  // Use resolve instead of path.resolve
    },
  },
  server: {
    port: 3000,
    // Bind all interfaces (not just localhost) so devices on the same
    // LAN/Wi-Fi - e.g. a phone - can reach this dev server via the
    // computer's local IP (http://<LAN-IP>:3000).
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
});