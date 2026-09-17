import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      // 'server-only' throws at import time outside RSC resolution — stub it so
      // the module graph (telegram -> shipping -> supabase admin) loads in Node.
      // Insertion order matters: the bare 'server-only' stub and specific
      // overrides must precede the generic '@' mapping.
      'server-only': path.resolve(__dirname, 'lib/__mocks__/server-only.ts'),
      '@/lib/supabase/server': path.resolve(__dirname, 'lib/__mocks__/supabase-server.ts'),
      '@': path.resolve(__dirname),
    },
  },
})
