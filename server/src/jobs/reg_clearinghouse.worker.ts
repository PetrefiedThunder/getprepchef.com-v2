import { Job } from 'bullmq';
import mongoose from 'mongoose';
import { createWorker, RegClearinghouseJobData, QUEUE_NAMES } from './queue';
import { Jurisdiction } from '@/modules/regintel/jurisdiction.model';
import { RegIntelService } from '@/modules/regintel/regintel.service';
import { VerificationService } from '@/modules/verification/verification.service';
import { WebhookService } from '@/modules/webhooks/webhook.service';
import { WEBHOOK_EVENT } from '@/config/constants';
import logger from '@/lib/logger';

/**
 * Regulatory Clearinghouse Worker
 * Processes regulatory update checks and synchronization
 *
 * For MVP: Simulates regulatory updates
 * In production: Would integrate with official APIs, scraping, etc.
 */

async function processRegClearinghouseJob(job: Job<RegClearinghouseJobData>): Promise<void> {
  const { jurisdiction_id, source } = job.data;

  logger.info({
    msg: 'Processing regulatory clearinghouse job',
    job_id: job.id,
    jurisdiction_id,
    source,
  });

  try {
    // Get jurisdictions to check
    let jurisdictions: any[];

    if (jurisdiction_id) {
      const jurisdiction = await Jurisdiction.findById(jurisdiction_id);
      jurisdictions = jurisdiction ? [jurisdiction] : [];
    } else {
      // Check all jurisdictions with coverage
      jurisdictions = await Jurisdiction.find({
        'metadata.coverage_status': { $in: ['full', 'partial'] },
      });
    }

    logger.info({
      msg: 'Checking regulatory updates for jurisdictions',
      count: jurisdictions.length,
    });

    let updatesDetected = 0;
    let jurisdictionsProcessed = 0;

    for (const jurisdiction of jurisdictions) {
      try {
        // Simulate checking for updates
        const hasUpdates = await checkForUpdates(jurisdiction._id);

        if (hasUpdates) {
          updatesDetected++;

          // Log the update
          await RegIntelService.logRegUpdate(
            jurisdiction._id,
            'requirement_modified',
            [], // Would include affected requirement IDs
            `Simulated regulatory update for ${jurisdiction.name}`,
            {
              affected_vendor_count: 0, // Would query actual count
              requires_reverification: true,
              urgency: 'medium',
            }
          );

          // Trigger re-verification for affected vendors
          const result = await VerificationService.reverifyJurisdiction(jurisdiction._id);

          logger.info({
            msg: 'Re-verification triggered for jurisdiction',
            jurisdiction_id: jurisdiction._id.toString(),
            vendors_queued: result.queued,
          });

          // Dispatch webhook to notify tenants
          // TODO: Get affected tenants and send notifications
        }

        jurisdictionsProcessed++;
      } catch (error) {
        logger.error({
          msg: 'Failed to process jurisdiction',
          jurisdiction_id: jurisdiction._id.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other jurisdictions
      }
    }

    logger.info({
      msg: 'Regulatory clearinghouse job completed',
      job_id: job.id,
      jurisdictions_processed: jurisdictionsProcessed,
      updates_detected: updatesDetected,
    });
  } catch (error) {
    logger.error({
      msg: 'Regulatory clearinghouse job failed',
      job_id: job.id,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Simulate checking for regulatory updates
 * In production, this would:
 * - Call external APIs
 * - Scrape official websites
 * - Check RSS feeds
 * - Compare current requirements with stored versions
 */
async function checkForUpdates(jurisdictionId: mongoose.Types.ObjectId): Promise<boolean> {
  // For MVP: randomly simulate updates (10% chance)
  const hasUpdate = Math.random() < 0.1;

  if (hasUpdate) {
    logger.info({
      msg: 'Simulated regulatory update detected',
      jurisdiction_id: jurisdictionId.toString(),
    });
  }

  return hasUpdate;
}

/**
 * Start regulatory clearinghouse worker
 */
export function startRegClearinghouseWorker(): void {
  const worker = createWorker<RegClearinghouseJobData>(
    QUEUE_NAMES.REG_CLEARINGHOUSE,
    processRegClearinghouseJob,
    {
      concurrency: 2, // Low concurrency for regulatory checks
    }
  );

  logger.info('Regulatory clearinghouse worker started');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing regulatory clearinghouse worker...');
    try {
      await worker.close();
    } catch (err) {
      logger.error({
        msg: 'Error closing regulatory clearinghouse worker',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

// Export for use in main worker process
export { processRegClearinghouseJob };
