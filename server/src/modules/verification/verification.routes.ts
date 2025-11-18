import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { VerificationService } from './verification.service';
import { validateParams, validateQuery } from '@/middleware/validation';
import { resolveTenant, TenantRequest } from '@/middleware/tenant.middleware';
import { objectIdSchema } from '@/lib/validators';

/**
 * Verification Routes
 * API endpoints for verification runs and history
 */

const vendorIdParamsSchema = z.object({
  vendor_id: objectIdSchema,
});

const runIdParamsSchema = z.object({
  run_id: objectIdSchema,
});

export async function verificationRoutes(fastify: FastifyInstance): Promise<void> {
  // All verification routes require tenant resolution
  fastify.addHook('preValidation', resolveTenant);

  /**
   * GET /vendors/:vendor_id/verification-runs
   * Get verification history for a vendor
   */
  fastify.get(
    '/vendors/:vendor_id/verification-runs',
    {
      preValidation: [validateParams(vendorIdParamsSchema)],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const { vendor_id } = request.params as any;

      const runs = await VerificationService.getVerificationHistory(
        vendor_id,
        tenantRequest.tenant_id!
      );

      reply.send({ verification_runs: runs });
    }
  );

  /**
   * GET /verification-runs/:run_id
   * Get specific verification run details
   */
  fastify.get(
    '/verification-runs/:run_id',
    {
      preValidation: [validateParams(runIdParamsSchema)],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const { run_id } = request.params as any;

      const run = await VerificationService.getVerificationRun(run_id, tenantRequest.tenant_id!);

      reply.send({ verification_run: run });
    }
  );

  /**
   * GET /verification-stats
   * Get verification statistics for tenant
   */
  fastify.get('/verification-stats', async (request, reply) => {
    const tenantRequest = request as TenantRequest;

    const stats = await VerificationService.getVerificationStats(tenantRequest.tenant_id!);

    reply.send({ stats });
  });
}
