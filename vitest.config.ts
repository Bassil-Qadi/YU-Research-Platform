import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Route tests share one in-memory MongoDB, and several assert on counters
    // that live in module state, so files must not run concurrently.
    fileParallelism: false,
    // Downloading and booting the MongoDB binary on a cold cache is slow.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    server: {
      deps: {
        // Left external, Node resolves next-auth's bare "next/server" import
        // against the filesystem and misses the package's export map. Letting
        // Vite process them applies the export map instead.
        inline: ['next-auth', '@auth/core'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
