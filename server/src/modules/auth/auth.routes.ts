import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { validateBody } from '@/middleware/validation';
import { authenticateUser, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { authRateLimitConfig } from '@/middleware/rate_limit';

/**
 * Auth Routes
 * Authentication endpoints: register, login, refresh, logout
 */

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  tenant_name: z.string().min(1),
  tenant_type: z.enum(['kitchen_operator', 'marketplace', 'ghost_kitchen']),
  contact_email: z.string().email().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /auth/register
   * Register new tenant with owner user
   */
  fastify.post(
    '/register',
    {
      preValidation: [validateBody(registerSchema)],
      config: {
        rateLimit: authRateLimitConfig,
      },
    },
    async (request, reply) => {
      const result = await AuthService.register(request.body as any);

      reply.status(201).send({
        user: {
          id: result.user._id.toString(),
          email: result.user.email,
          first_name: result.user.first_name,
          last_name: result.user.last_name,
          role: result.user.role,
        },
        tenant: {
          id: result.tenant._id.toString(),
          name: result.tenant.name,
          type: result.tenant.type,
          status: result.tenant.status,
        },
        tokens: result.tokens,
      });
    }
  );

  /**
   * POST /auth/login
   * Login with email and password
   */
  fastify.post(
    '/login',
    {
      preValidation: [validateBody(loginSchema)],
      config: {
        rateLimit: authRateLimitConfig,
      },
    },
    async (request, reply) => {
      const result = await AuthService.login(request.body as any);

      reply.send({
        user: {
          id: result.user._id.toString(),
          email: result.user.email,
          first_name: result.user.first_name,
          last_name: result.user.last_name,
          role: result.user.role,
          tenant_id: result.user.tenant_id?.toString(),
        },
        tokens: result.tokens,
      });
    }
  );

  /**
   * POST /auth/refresh
   * Refresh access token
   */
  fastify.post(
    '/refresh',
    {
      preValidation: [validateBody(refreshSchema)],
    },
    async (request, reply) => {
      const { refresh_token } = request.body as any;
      const tokens = await AuthService.refreshToken(refresh_token);

      reply.send({ tokens });
    }
  );

  /**
   * POST /auth/logout
   * Logout (invalidate refresh tokens)
   */
  fastify.post(
    '/logout',
    {
      preValidation: [authenticateUser],
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      await AuthService.logout(authRequest.user!.id);

      reply.send({ message: 'Logged out successfully' });
    }
  );

  /**
   * GET /auth/me
   * Get current user info
   */
  fastify.get(
    '/me',
    {
      preValidation: [authenticateUser],
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;

      reply.send({
        user: authRequest.user,
      });
    }
  );
}
