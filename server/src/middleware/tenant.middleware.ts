import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from './error_handler';

/**
 * Tenant resolution middleware
 * Resolves tenant from X-Prep-Api-Key header and enforces isolation
 *
 * Will be fully implemented in Phase 5
 */

// Extended request type with tenant context
export interface TenantRequest extends FastifyRequest {
  tenant?: {
    id: string;
    name: string;
    type: string;
  };
}

/**
 * Resolve tenant from API key header
 */
export async function resolveTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-prep-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    throw new UnauthorizedError('Missing or invalid API key');
  }

  // TODO: Implement in Phase 5
  // 1. Hash the API key
  // 2. Look up tenant by hashed API key
  // 3. Attach tenant to request
  // 4. Update api_key.last_used_at

  // For now, this is a placeholder
  throw new UnauthorizedError('Tenant resolution not yet implemented');
}

/**
 * Ensure request is scoped to authenticated tenant
 * Used to prevent cross-tenant data access
 */
export function ensureTenantScope(tenantIdField: string = 'tenant_id') {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const tenantRequest = request as TenantRequest;

    if (!tenantRequest.tenant) {
      throw new UnauthorizedError('Tenant not resolved');
    }

    // Additional scoping logic will be implemented in Phase 5
    // This will ensure that all queries include tenant_id filter
  };
}
