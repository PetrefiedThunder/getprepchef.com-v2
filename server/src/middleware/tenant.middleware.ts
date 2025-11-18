import { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { Tenant } from '@/modules/tenants/tenant.model';
import { UnauthorizedError } from './error_handler';

/**
 * Tenant resolution middleware
 * Resolves tenant from X-Prep-Api-Key header and enforces isolation
 */

// Extended request type with tenant context
export interface TenantRequest extends FastifyRequest {
  tenant?: {
    id: string;
    name: string;
    type: string;
  };
  tenant_id?: mongoose.Types.ObjectId; // For easy access in services
}

/**
 * Resolve tenant from API key header
 */
export async function resolveTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantRequest = request as TenantRequest;
  const apiKey = request.headers['x-prep-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    throw new UnauthorizedError('Missing or invalid API key');
  }

  // Look up tenant by API key
  const tenant = await Tenant.findByApiKey(apiKey);

  if (!tenant) {
    throw new UnauthorizedError('Invalid API key');
  }

  // Attach tenant to request
  tenantRequest.tenant = {
    id: tenant._id.toString(),
    name: tenant.name,
    type: tenant.type,
  };
  tenantRequest.tenant_id = tenant._id;
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
