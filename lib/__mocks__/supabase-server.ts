// Test stub for lib/supabase/server — avoids the 'server-only' boundary and
// next/headers cookie access in unit tests. Only used via vitest.config.ts alias.
export async function createClient(): Promise<never> {
  throw new Error('createClient() must not be called in unit tests')
}
