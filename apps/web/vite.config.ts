import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for Protekt frontend
export default defineConfig({
  plugins: [react()],
  root: '.',
  server: {
    port: 3000,
    proxy: {
      // forward API calls to backend dev server
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});