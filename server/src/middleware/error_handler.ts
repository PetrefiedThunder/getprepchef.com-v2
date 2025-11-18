import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import logger from '@/lib/logger';
import { config } from '@/config/env';

/**
 * Custom error classes for domain-specific errors
 */

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(500, message, 'INTERNAL_SERVER_ERROR');
    this.name = 'InternalServerError';
  }
}

/**
 * Error response format
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
  request_id?: string;
}

/**
 * Global error handler for Fastify
 */
export async function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestId = request.id;

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    logger.warn({
      msg: 'Validation error',
      request_id: requestId,
      path: request.url,
      errors: error.errors,
    });

    const response: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      },
      request_id: requestId,
    };

    reply.status(400).send(response);
    return;
  }

  // Handle custom AppError
  if (error instanceof AppError) {
    logger.warn({
      msg: 'Application error',
      request_id: requestId,
      path: request.url,
      error: error.message,
      code: error.code,
      status: error.statusCode,
    });

    const response: ErrorResponse = {
      error: {
        code: error.code || 'APPLICATION_ERROR',
        message: error.message,
        details: error.details,
      },
      request_id: requestId,
    };

    reply.status(error.statusCode).send(response);
    return;
  }

  // Handle Fastify validation errors
  if ('validation' in error && error.validation) {
    logger.warn({
      msg: 'Fastify validation error',
      request_id: requestId,
      path: request.url,
      validation: error.validation,
    });

    const response: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.validation,
      },
      request_id: requestId,
    };

    reply.status(400).send(response);
    return;
  }

  // Handle Fastify errors (rate limit, etc.)
  if ('statusCode' in error && error.statusCode) {
    logger.warn({
      msg: 'Fastify error',
      request_id: requestId,
      path: request.url,
      error: error.message,
      status: error.statusCode,
    });

    const response: ErrorResponse = {
      error: {
        code: error.code || 'FASTIFY_ERROR',
        message: error.message,
      },
      request_id: requestId,
    };

    reply.status(error.statusCode).send(response);
    return;
  }

  // Handle unknown errors (500)
  logger.error({
    msg: 'Unhandled error',
    request_id: requestId,
    path: request.url,
    method: request.method,
    error: error.message,
    stack: error.stack,
  });

  const response: ErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: config.NODE_ENV === 'production'
        ? 'An internal server error occurred'
        : error.message,
      ...(config.NODE_ENV === 'development' && { stack: error.stack }),
    },
    request_id: requestId,
  };

  reply.status(500).send(response);
}
