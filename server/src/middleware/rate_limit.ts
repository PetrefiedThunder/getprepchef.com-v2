import { FastifyRequest } from 'fastify';
import { config } from '@/config/env';

/**
 * Rate limiting configuration for different endpoints
 *
 * Uses @fastify/rate-limit with Redis store in production
 * In-memory store for development/testing
 */

/**
 * Default rate limit config
 */
export const defaultRateLimitConfig = {
  max: config.RATE_LIMIT_MAX,
  timeWindow: config.RATE_LIMIT_WINDOW_MS,
  cache: 10000, // Cache size (in-memory)
  allowList: ['127.0.0.1'], // Never rate limit localhost
  redis: undefined, // Will be set in app.ts if Redis is configured
  keyGenerator: (request: FastifyRequest) => {
    // Rate limit by tenant API key if present, otherwise by IP
    const apiKey = request.headers['x-prep-api-key'];
    if (apiKey && typeof apiKey === 'string') {
      return `api_key:${apiKey}`;
    }
    return request.ip;
  },
  errorResponseBuilder: () => {
    return {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    };
  },
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
};

/**
 * Strict rate limit for authentication endpoints
 */
export const authRateLimitConfig = {
  ...defaultRateLimitConfig,
  max: 5, // 5 attempts
  timeWindow: 15 * 60 * 1000, // 15 minutes
  keyGenerator: (request: FastifyRequest) => {
    // Rate limit by IP for auth endpoints
    return `auth:${request.ip}`;
  },
  errorResponseBuilder: () => {
    return {
      error: {
        code: 'TOO_MANY_LOGIN_ATTEMPTS',
        message: 'Too many login attempts, please try again in 15 minutes',
      },
    };
  },
};

/**
 * Relaxed rate limit for public API endpoints
 */
export const publicApiRateLimitConfig = {
  ...defaultRateLimitConfig,
  max: 1000, // 1000 requests
  timeWindow: 60 * 60 * 1000, // 1 hour
};

/**
 * Strict rate limit for webhook management endpoints
 */
export const webhookRateLimitConfig = {
  ...defaultRateLimitConfig,
  max: 10, // 10 requests
  timeWindow: 60 * 1000, // 1 minute
};
