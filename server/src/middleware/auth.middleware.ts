import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '@/modules/auth/auth.service';
import { UnauthorizedError, ForbiddenError } from './error_handler';
import { USER_ROLES, UserRole } from '@/config/constants';

/**
 * Authentication middleware
 * Validates JWT tokens and attaches user to request
 */

// Extended request type with user context
export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    tenant_id?: string;
    token_version: number;
  };
}

/**
 * Verify JWT and attach user to request
 */
export async function authenticateUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authRequest = request as AuthenticatedRequest;

  // Extract token from Authorization header
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // Verify token
    const payload = AuthService.verifyAccessToken(token);

    // Attach user to request
    authRequest.user = {
      id: payload.user_id,
      email: payload.email,
      role: payload.role,
      tenant_id: payload.tenant_id,
      token_version: payload.token_version,
    };
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
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

/**
 * Require any authenticated user
 */
export const requireAuth = authenticateUser;
