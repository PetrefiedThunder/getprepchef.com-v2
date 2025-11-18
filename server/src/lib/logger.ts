import pino from 'pino';
import { config } from '@/config/env';

/**
 * Centralized logger using Pino
 *
 * Features:
 * - Structured logging (JSON in production, pretty in dev)
 * - PII-safe: use `sanitize` helper for sensitive data
 * - Performance: async logging, minimal overhead
 */

const isDevelopment = config.NODE_ENV === 'development';

export const logger = pino({
  level: config.LOG_LEVEL,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDevelopment && config.LOG_PRETTY
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

/**
 * Sanitize PII from log objects
 * Redacts sensitive fields before logging
 */
export function sanitize<T extends Record<string, any>>(obj: T): T {
  const sensitiveFields = [
    'password',
    'password_hash',
    'ssn',
    'ssn_last4',
    'tax_id',
    'secret',
    'api_key',
    'access_token',
    'refresh_token',
    'authorization',
  ];

  const sanitized = { ...obj };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Create child logger with additional context
 */
export function createLogger(context: Record<string, any>) {
  return logger.child(sanitize(context));
}

export default logger;
