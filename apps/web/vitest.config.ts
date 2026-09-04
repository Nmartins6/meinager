import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: '../..',
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    env: {
      VITE_API_URL: 'http://localhost:3000/api',
    },
  },
});
