/**
 * Structured Logger — ProjectPilot Neuro
 *
 * A minimal, zero-dependency structured logger designed for:
 * - Development: coloured, readable console output
 * - Production: JSON lines (compatible with AWS CloudWatch, Datadog, etc.)
 *
 * Usage:
 *   import { log } from '@/lib/logger';
 *   log.info('task.created', { taskId, userId });
 *   log.warn('auth.suspicious', { userId, reason: 'multiple failed attempts' });
 *   log.error('db.query_failed', { model: 'Task', error: err.message });
 *
 * Privacy notes:
 *   - NEVER log raw field values from CognitiveProfile or OverloadSignal.
 *   - NEVER log privateNote or encrypted field contents.
 *   - Log entity IDs only, not personal data, in production.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMeta = Record<string, unknown>;

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info:  '\x1b[32m', // green
  warn:  '\x1b[33m', // yellow
  error: '\x1b[31m', // red
};
const RESET = '\x1b[0m';

function write(level: LogLevel, event: string, meta: LogMeta = {}): void {
  if (IS_TEST) return;

  const ts = new Date().toISOString();

  if (IS_PROD) {
    // JSON lines for cloud log aggregators
    process.stdout.write(JSON.stringify({ ts, level, event, ...meta }) + '\n');
  } else {
    const colour = LEVEL_COLORS[level];
    const prefix = `${colour}[${level.toUpperCase()}]${RESET}`;
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    console.log(`${prefix} ${ts} ${event}${metaStr}`);
  }
}

export const log = {
  debug: (event: string, meta?: LogMeta) => write('debug', event, meta),
  info:  (event: string, meta?: LogMeta) => write('info',  event, meta),
  warn:  (event: string, meta?: LogMeta) => write('warn',  event, meta),
  error: (event: string, meta?: LogMeta) => write('error', event, meta),
};

/**
 * Wraps an async function with error logging and re-throw.
 * Useful in API routes to ensure errors are always logged in production.
 */
export async function withLogging<T>(
  event: string,
  fn: () => Promise<T>,
  meta?: LogMeta
): Promise<T> {
  try {
    const result = await fn();
    return result;
  } catch (err) {
    log.error(`${event}.failed`, {
      ...meta,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
