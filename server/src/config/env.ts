import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

/**
 * Environment configuration schema with strict validation
 * Follows security best practices: no hardcoded secrets, all configs explicit
 */
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Server
  PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('3000'),
  HOST: z.string().default('0.0.0.0'),

  // Database
  MONGODB_URI: z.string().url().default('mongodb://localhost:27017/prepchef'),
  MONGODB_MAX_POOL_SIZE: z.string().transform(Number).pipe(z.number().int().positive()).default('10'),

  // Redis (for BullMQ)
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).pipe(z.number().int().min(0)).default('0'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(Number).pipe(z.number().int().positive()).default('100'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().int().positive()).default('60000'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // File Storage (S3-compatible)
  STORAGE_TYPE: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // Webhook
  WEBHOOK_SIGNING_SECRET: z.string().min(32).default('dev-webhook-secret-change-in-production-min-32-chars'),
  WEBHOOK_TIMEOUT_MS: z.string().transform(Number).pipe(z.number().int().positive()).default('5000'),
  WEBHOOK_MAX_RETRIES: z.string().transform(Number).pipe(z.number().int().min(0)).default('3'),

  // External Services (stubs for MVP)
  SENDGRID_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: z.string().transform(v => v === 'true').default('true'),

  // Security
  BCRYPT_ROUNDS: z.string().transform(Number).pipe(z.number().int().min(10).max(15)).default('12'),

  // Background Jobs
  VERIFICATION_JOB_CONCURRENCY: z.string().transform(Number).pipe(z.number().int().positive()).default('5'),
  REG_CLEARINGHOUSE_CRON: z.string().default('0 8,12,20 * * *'), // 8am, 12pm, 8pm PT

  // Feature Flags (for MVP)
  ENABLE_EMAIL_NOTIFICATIONS: z.string().transform(v => v === 'true').default('false'),
  ENABLE_SMS_NOTIFICATIONS: z.string().transform(v => v === 'true').default('false'),
});

type Env = z.infer<typeof envSchema>;

/**
 * Validated environment configuration
 * Throws on startup if required env vars are missing or invalid
 */
let config: Env;

try {
  config = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment configuration:');
    console.error(JSON.stringify(error.errors, null, 2));
    process.exit(1);
  }
  throw error;
}

export { config };
export type { Env };
