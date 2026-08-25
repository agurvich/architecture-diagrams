import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**'],
    css: false,
    // Node 22+'s own experimental global localStorage otherwise wins the
    // slot over jsdom's actually-functional one (same property, two
    // competing definitions — Node's throws/no-ops without a
    // --localstorage-file backing it), silently breaking every
    // localStorage read/write in tests. Disabling it lets jsdom's
    // environment own window.localStorage properly.
    execArgv: ['--no-experimental-webstorage'],
  },
});
