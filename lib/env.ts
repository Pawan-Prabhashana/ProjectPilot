/**
 * Environment variable validation.
 * Validated at module import time — the app crashes fast with a clear error
 * rather than failing silently at runtime with a cryptic undefined reference.
 *
 * Call this from server entry points (not client components).
 */

import { z } from 'zod';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid connection string' }),
  NEXTAUTH_URL: z.string().url({ message: 'NEXTAUTH_URL must be a valid URL' }),
  NEXTAUTH_SECRET: z.string().min(32, { message: 'NEXTAUTH_SECRET must be at least 32 characters' }),
  ENCRYPTION_SECRET: z
    .string()
    .min(32, { message: 'ENCRYPTION_SECRET must be at least 32 characters (base64 preferred)' }),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

let _env: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (_env) return _env;

  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`❌ Missing or invalid environment variables:\n${issues}\n\nSee .env.example for reference.`);
  }

  _env = result.data;
  return _env;
}

// Convenience re-export for quick access in server modules.
// Calling this also validates env at import time.
export const env = typeof window === 'undefined' ? (() => {
  try { return getServerEnv(); } catch { return null as unknown as ServerEnv; }
})() : null as unknown as ServerEnv;
