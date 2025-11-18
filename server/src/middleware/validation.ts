import { FastifyRequest, FastifyReply, preValidationHookHandler } from 'fastify';
import { ZodSchema, ZodError } from 'zod';

/**
 * Schema validation middleware factory
 * Validates request body, query params, or path params against Zod schemas
 */

type RequestPart = 'body' | 'query' | 'params';

/**
 * Create validation middleware for a Zod schema
 */
export function validate<T>(
  schema: ZodSchema<T>,
  part: RequestPart = 'body'
): preValidationHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const data = request[part];
      request[part] = await schema.parseAsync(data);
    } catch (error) {
      if (error instanceof ZodError) {
        // Let the global error handler deal with it
        throw error;
      }
      throw error;
    }
  };
}

/**
 * Validate request body
 */
export function validateBody<T>(schema: ZodSchema<T>): preValidationHookHandler {
  return validate(schema, 'body');
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>): preValidationHookHandler {
  return validate(schema, 'query');
}

/**
 * Validate path parameters
 */
export function validateParams<T>(schema: ZodSchema<T>): preValidationHookHandler {
  return validate(schema, 'params');
}
