import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { config } from '@/config/env';
import logger from '@/lib/logger';
import { errorHandler } from '@/middleware/error_handler';
import { defaultRateLimitConfig } from '@/middleware/rate_limit';
import { getDatabaseHealth } from '@/db/connection';

/**
 * Create and configure Fastify application
 *
 * Features:
 * - CORS with configurable origins
 * - Helmet for security headers
 * - Rate limiting (in-memory for dev, Redis for prod)
 * - Multipart support for file uploads
 * - Request ID generation
 * - Global error handling
 * - Health endpoints
 */

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'request_id',
    genReqId: () => {
      return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    },
    trustProxy: true, // Important for rate limiting behind proxy
  });

  // Register plugins
  await registerPlugins(app);

  // Register routes
  await registerRoutes(app);

  // Set error handler (must be after routes)
  app.setErrorHandler(errorHandler);

  return app;
}

/**
 * Register Fastify plugins
 */
async function registerPlugins(app: FastifyInstance): Promise<void> {
  // CORS
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(',').map(o => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Prep-Api-Key',
      'X-Request-ID',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for dev
  });

  // Rate limiting
  await app.register(rateLimit, defaultRateLimitConfig);

  // Multipart support for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5, // Max 5 files per request
    },
  });

  logger.info('Fastify plugins registered');
}

/**
 * Register application routes
 */
async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health check endpoint
  app.get('/health', async (request, reply) => {
    const dbHealth = getDatabaseHealth();

    const health = {
      status: dbHealth.connected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.NODE_ENV,
      database: {
        connected: dbHealth.connected,
        ready_state: dbHealth.readyState,
        host: dbHealth.host,
        database: dbHealth.database,
      },
    };

    const statusCode = dbHealth.connected ? 200 : 503;
    reply.status(statusCode).send(health);
  });

  // Readiness check (for Kubernetes)
  app.get('/ready', async (request, reply) => {
    const dbHealth = getDatabaseHealth();

    if (dbHealth.connected) {
      reply.status(200).send({ status: 'ready' });
    } else {
      reply.status(503).send({ status: 'not_ready', reason: 'database_not_connected' });
    }
  });

  // Liveness check (for Kubernetes)
  app.get('/live', async (request, reply) => {
    reply.status(200).send({ status: 'alive' });
  });

  // API version info
  app.get('/', async (request, reply) => {
    reply.send({
      name: 'PrepChef API',
      version: 'v1',
      description: 'Vendor Verification as a Service for shared kitchens',
      documentation: '/docs', // Future: OpenAPI docs
      health: '/health',
    });
  });

  // Register API routes
  const { authRoutes } = await import('@/modules/auth/auth.routes');
  const { vendorRoutes } = await import('@/modules/vendors/vendor.routes');
  const { verificationRoutes } = await import('@/modules/verification/verification.routes');
  const { regintelRoutes } = await import('@/modules/regintel/regintel.routes');
  const { webhookRoutes } = await import('@/modules/webhooks/webhook.routes');

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(vendorRoutes, { prefix: '/api/v1/vendors' });
  await app.register(verificationRoutes, { prefix: '/api/v1' });
  await app.register(regintelRoutes, { prefix: '/api/v1' });
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });

  logger.info('Application routes registered');
}

export default createApp;
