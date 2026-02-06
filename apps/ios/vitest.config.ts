import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import type { PluginOption } from 'vitest/node_modules/vite';

export default defineConfig({
  plugins: [react() as unknown as PluginOption],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: './tests/setup.ts',
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.{ts,js}',
        '**/types.ts',
      ],
    },
  },
});
