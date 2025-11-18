import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError, ForbiddenError } from './error_handler';
import { USER_ROLES, UserRole } from '@/config/constants';

/**
 * Authentication middleware
 * Validates JWT tokens and attaches user to request
 *
 * Will be fully implemented in Phase 5
 */

// Extended request type with user context
export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    tenant_id?: string;
  };
}

/**
 * Verify JWT and attach user to request
 */
export async function authenticateUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // TODO: Implement in Phase 5
  // For now, this is a placeholder
  throw new UnauthorizedError('Authentication not yet implemented');
}

/**
 * Require specific roles
 */
export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authRequest = request as AuthenticatedRequest;

    if (!authRequest.user) {
      throw new UnauthorizedError('User not authenticated');
    }

    if (!roles.includes(authRequest.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
  };
}

/**
 * Require admin role
 */
export const requireAdmin = requireRole(USER_ROLES.ADMIN);

/**
 * Require tenant owner or admin role
 */
export const requireTenantOwner = requireRole(
  USER_ROLES.ADMIN,
  USER_ROLES.TENANT_OWNER
);
