import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RegIntelService } from './regintel.service';
import { validateQuery, validateParams } from '@/middleware/validation';
import { resolveTenant } from '@/middleware/tenant.middleware';
import { objectIdSchema } from '@/lib/validators';

/**
 * Regulatory Intelligence Routes
 * Public API for accessing regulatory requirements and jurisdictions
 */

const jurisdictionIdParamsSchema = z.object({
  id: objectIdSchema,
});

const checklistQuerySchema = z.object({
  jurisdiction_id: objectIdSchema.optional(),
  state: z.string().length(2).optional(),
  county: z.string().optional(),
  kitchen_type: z.enum(['shared', 'ghost', 'commissary']),
  entity_type: z.enum(['sole_proprietorship', 'llc', 'corporation', 'partnership']),
});

const jurisdictionsQuerySchema = z.object({
  type: z.enum(['country', 'state', 'county', 'city']).optional(),
  coverage_status: z.enum(['full', 'partial', 'none']).optional(),
});

export async function regintelRoutes(fastify: FastifyInstance): Promise<void> {
  // All regintel routes require tenant resolution
  fastify.addHook('preValidation', resolveTenant);

  /**
   * GET /checklists
   * Get regulatory checklist for given parameters
   */
  fastify.get(
    '/checklists',
    {
      preValidation: [validateQuery(checklistQuerySchema)],
    },
    async (request, reply) => {
      const query = request.query as any;

      const result = await RegIntelService.getChecklist(query);

      reply.send(result);
    }
  );

  /**
   * GET /jurisdictions
   * List jurisdictions
   */
  fastify.get(
    '/jurisdictions',
    {
      preValidation: [validateQuery(jurisdictionsQuerySchema)],
    },
    async (request, reply) => {
      const query = request.query as any;

      const jurisdictions = await RegIntelService.listJurisdictions({
        type: query.type,
        coverage_status: query.coverage_status,
      });

      reply.send({ jurisdictions });
    }
  );

  /**
   * GET /jurisdictions/:id
   * Get jurisdiction details
   */
  fastify.get(
    '/jurisdictions/:id',
    {
      preValidation: [validateParams(jurisdictionIdParamsSchema)],
    },
    async (request, reply) => {
      const { id } = request.params as any;

      const hierarchy = await RegIntelService.getJurisdictionHierarchy(id);
      const requirements = await RegIntelService.getJurisdictionRequirements(id, true);
      const healthDept = await RegIntelService.getHealthDept(id);

      reply.send({
        jurisdiction: hierarchy[hierarchy.length - 1],
        hierarchy,
        requirements,
        health_dept: healthDept,
      });
    }
  );

  /**
   * GET /coverage-stats
   * Get regulatory coverage statistics
   */
  fastify.get('/coverage-stats', async (request, reply) => {
    const stats = await RegIntelService.getCoverageStats();

    reply.send({ stats });
  });
}
