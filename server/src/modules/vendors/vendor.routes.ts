import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { z } from 'zod';
import { VendorService } from './vendor.service';
import { validateBody, validateQuery, validateParams } from '@/middleware/validation';
import { resolveTenant, TenantRequest } from '@/middleware/tenant.middleware';
import { addressSchema, contactSchema, paginationSchema, objectIdSchema } from '@/lib/validators';

/**
 * Vendor Routes
 * Public API for vendor management (tenant-scoped via API key)
 */

// Validation schemas
const createVendorSchema = z.object({
  kitchen_id: objectIdSchema,
  business_name: z.string().min(1),
  dba_name: z.string().optional(),
  legal_entity_type: z.enum(['sole_proprietorship', 'llc', 'corporation', 'partnership']),
  tax_id_encrypted: z.string().optional(),
  business_address: addressSchema,
  contact: contactSchema,
  metadata: z.record(z.any()).optional(),
});

const updateVendorSchema = z.object({
  business_name: z.string().min(1).optional(),
  dba_name: z.string().optional(),
  legal_entity_type: z.enum(['sole_proprietorship', 'llc', 'corporation', 'partnership']).optional(),
  business_address: addressSchema.partial().optional(),
  contact: contactSchema.partial().optional(),
  metadata: z.record(z.any()).optional(),
});

const listVendorsQuerySchema = paginationSchema.extend({
  status: z.enum(['pending', 'verified', 'needs_review', 'rejected', 'expired', 'suspended']).optional(),
  kitchen_id: objectIdSchema.optional(),
  search: z.string().optional(),
});

const vendorIdParamsSchema = z.object({
  id: objectIdSchema,
});

export async function vendorRoutes(fastify: FastifyInstance): Promise<void> {
  // All vendor routes require tenant resolution via API key
  fastify.addHook('preValidation', resolveTenant);

  /**
   * POST /vendors
   * Create new vendor
   */
  fastify.post(
    '/',
    {
      preValidation: [validateBody(createVendorSchema)],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const body = request.body as any;

      const vendor = await VendorService.createVendor({
        tenant_id: tenantRequest.tenant_id!,
        ...body,
        kitchen_id: new mongoose.Types.ObjectId(body.kitchen_id),
      });

      reply.status(201).send({ vendor });
    }
  );

  /**
   * GET /vendors
   * List vendors with filters
   */
  fastify.get(
    '/',
    {
      preValidation: [validateQuery(listVendorsQuerySchema)],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const query = request.query as any;

      const result = await VendorService.listVendors(
        tenantRequest.tenant_id!,
        {
          status: query.status,
          kitchen_id: query.kitchen_id,
          search: query.search,
        },
        query.page,
        query.limit
      );

      reply.send(result);
    }
  );

  /**
   * GET /vendors/:id
   * Get vendor details
   */
  fastify.get(
    '/:id',
    {
      preValidation: [validateParams(vendorIdParamsSchema)],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const { id } = request.params as any;

      const result = await VendorService.getVendorWithDetails(id, tenantRequest.tenant_id!);

      reply.send(result);
    }
  );

  /**
   * PATCH /vendors/:id
   * Update vendor
   */
  fastify.patch(
    '/:id',
    {
      preValidation: [
        validateParams(vendorIdParamsSchema),
        validateBody(updateVendorSchema),
      ],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const { id } = request.params as any;
      const body = request.body as any;

      const vendor = await VendorService.updateVendor(id, tenantRequest.tenant_id!, body);

      reply.send({ vendor });
    }
  );

  /**
   * DELETE /vendors/:id
   * Delete vendor (soft delete - mark as suspended)
   */
  fastify.delete(
    '/:id',
    {
      preValidation: [validateParams(vendorIdParamsSchema)],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const { id } = request.params as any;

      await VendorService.deleteVendor(id, tenantRequest.tenant_id!);

      reply.status(204).send();
    }
  );

  /**
   * POST /vendors/:id/verify
   * Trigger verification run for vendor
   */
  fastify.post(
    '/:id/verify',
    {
      preValidation: [validateParams(vendorIdParamsSchema)],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const { id } = request.params as any;

      // Import here to avoid circular dependency
      const { Queues } = await import('@/jobs/queue');

      // Enqueue verification job
      const job = await Queues.addVerificationJob({
        vendor_id: id,
        tenant_id: tenantRequest.tenant_id!.toString(),
        triggered_by: 'manual',
      });

      reply.send({
        message: 'Verification job queued',
        job_id: job.id,
      });
    }
  );
}
