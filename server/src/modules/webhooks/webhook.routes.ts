import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { WebhookService } from './webhook.service';
import { validateBody, validateParams, validateQuery } from '@/middleware/validation';
import { resolveTenant, TenantRequest } from '@/middleware/tenant.middleware';
import { objectIdSchema } from '@/lib/validators';
import { WEBHOOK_EVENT } from '@/config/constants';

/**
 * Webhook Routes
 * API endpoints for webhook subscription management
 */

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum([
    'vendor.created',
    'vendor.updated',
    'vendor.verified',
    'vendor.needs_review',
    'vendor.rejected',
    'vendor.expired',
    'vendor.suspended',
    'vendor.document_uploaded',
    'regulation.updated',
    'regulation.new_requirement',
  ] as const)).min(1),
  headers: z.record(z.string()).optional(),
});

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  status: z.enum(['active', 'paused', 'disabled']).optional(),
  headers: z.record(z.string()).optional(),
});

const webhookIdParamsSchema = z.object({
  id: objectIdSchema,
});

const deliveryLogsQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(500)).default('100'),
});

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  // All webhook routes require tenant resolution
  fastify.addHook('preValidation', resolveTenant);

  /**
   * POST /webhooks
   * Create webhook endpoint
   */
  fastify.post(
    '/',
    {
      preValidation: [validateBody(createWebhookSchema)],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const { url, events, headers } = request.body as any;

      const endpoint = await WebhookService.createEndpoint(
        tenantRequest.tenant_id!,
        url,
        events
      );

      // Update headers if provided
      if (headers) {
        await WebhookService.updateEndpoint(endpoint._id.toString(), tenantRequest.tenant_id!, {
          headers,
        });
      }

      reply.status(201).send({ webhook_endpoint: endpoint });
    }
  );

  /**
   * GET /webhooks
   * List webhook endpoints
   */
  fastify.get('/', async (request, reply) => {
    const tenantRequest = request as TenantRequest;

    const endpoints = await WebhookService.listEndpoints(tenantRequest.tenant_id!);

    reply.send({ webhook_endpoints: endpoints });
  });

  /**
   * GET /webhooks/:id
   * Get webhook endpoint details
   */
  fastify.get(
    '/:id',
    {
      preValidation: [validateParams(webhookIdParamsSchema)],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const { id } = request.params as any;

      const endpoint = await WebhookService.getEndpoint(id, tenantRequest.tenant_id!);

      reply.send({ webhook_endpoint: endpoint });
    }
  );

  /**
   * PATCH /webhooks/:id
   * Update webhook endpoint
   */
  fastify.patch(
    '/:id',
    {
      preValidation: [
        validateParams(webhookIdParamsSchema),
        validateBody(updateWebhookSchema),
      ],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const { id } = request.params as any;
      const updates = request.body as any;

      const endpoint = await WebhookService.updateEndpoint(id, tenantRequest.tenant_id!, updates);

      reply.send({ webhook_endpoint: endpoint });
    }
  );

  /**
   * DELETE /webhooks/:id
   * Delete webhook endpoint (disable)
   */
  fastify.delete(
    '/:id',
    {
      preValidation: [validateParams(webhookIdParamsSchema)],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const { id } = request.params as any;

      await WebhookService.deleteEndpoint(id, tenantRequest.tenant_id!);

      reply.status(204).send();
    }
  );

  /**
   * POST /webhooks/:id/pause
   * Pause webhook endpoint
   */
  fastify.post(
    '/:id/pause',
    {
      preValidation: [validateParams(webhookIdParamsSchema)],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const { id } = request.params as any;

      await WebhookService.pauseEndpoint(id, tenantRequest.tenant_id!);

      reply.send({ message: 'Webhook endpoint paused' });
    }
  );

  /**
   * POST /webhooks/:id/resume
   * Resume webhook endpoint
   */
  fastify.post(
    '/:id/resume',
    {
      preValidation: [validateParams(webhookIdParamsSchema)],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const { id } = request.params as any;

      await WebhookService.resumeEndpoint(id, tenantRequest.tenant_id!);

      reply.send({ message: 'Webhook endpoint resumed' });
    }
  );

  /**
   * GET /webhooks/:id/deliveries
   * Get delivery logs for webhook endpoint
   */
  fastify.get(
    '/:id/deliveries',
    {
      preValidation: [
        validateParams(webhookIdParamsSchema),
        validateQuery(deliveryLogsQuerySchema),
      ],
    },
    async (request, reply) => {
      const tenantRequest = request as TenantRequest;
      const { id } = request.params as any;
      const { limit } = request.query as any;

      const deliveries = await WebhookService.getDeliveryLogs(
        id,
        tenantRequest.tenant_id!,
        limit
      );

      reply.send({ deliveries });
    }
  );
}
