import { Job } from 'bullmq';
import mongoose from 'mongoose';
import { createWorker, VerificationJobData, QUEUE_NAMES, Queues } from './queue';
import { VerificationService } from '@/modules/verification/verification.service';
import { WebhookService } from '@/modules/webhooks/webhook.service';
import { WEBHOOK_EVENT } from '@/config/constants';
import logger from '@/lib/logger';

/**
 * Verification Worker
 * Processes vendor verification jobs
 */

async function processVerificationJob(job: Job<VerificationJobData>): Promise<void> {
  const { vendor_id, tenant_id, triggered_by, user_id } = job.data;

  logger.info({
    msg: 'Processing verification job',
    job_id: job.id,
    vendor_id,
    tenant_id,
  });

  try {
    // Execute verification
    const verificationRun = await VerificationService.triggerVerification(
      vendor_id,
      new mongoose.Types.ObjectId(tenant_id),
      triggered_by as any,
      user_id ? new mongoose.Types.ObjectId(user_id) : undefined
    );

    logger.info({
      msg: 'Verification completed',
      job_id: job.id,
      vendor_id,
      outcome: verificationRun.outcome,
    });

    // Dispatch webhook based on outcome
    if (verificationRun.outcome) {
      const webhookEvent = mapOutcomeToWebhookEvent(verificationRun.outcome);

      if (webhookEvent) {
        await WebhookService.dispatchEvent(
          new mongoose.Types.ObjectId(tenant_id),
          webhookEvent,
          {
            vendor_id,
            verification_run_id: verificationRun._id.toString(),
            outcome: verificationRun.outcome,
            completion_percentage: verificationRun.checklist.completion_percentage,
            outcome_reason: verificationRun.outcome_reason,
          }
        );
      }
    }
  } catch (error) {
    logger.error({
      msg: 'Verification job failed',
      job_id: job.id,
      vendor_id,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error; // Re-throw to mark job as failed
  }
}

/**
 * Map verification outcome to webhook event
 */
function mapOutcomeToWebhookEvent(outcome: string): typeof WEBHOOK_EVENT[keyof typeof WEBHOOK_EVENT] | null {
  const mapping: Record<string, typeof WEBHOOK_EVENT[keyof typeof WEBHOOK_EVENT]> = {
    verified: WEBHOOK_EVENT.VENDOR_VERIFIED,
    needs_review: WEBHOOK_EVENT.VENDOR_NEEDS_REVIEW,
    rejected: WEBHOOK_EVENT.VENDOR_REJECTED,
    expired: WEBHOOK_EVENT.VENDOR_EXPIRED,
  };

  return mapping[outcome] || null;
}

/**
 * Start verification worker
 */
export function startVerificationWorker(): void {
  const worker = createWorker<VerificationJobData>(
    QUEUE_NAMES.VERIFICATION,
    processVerificationJob,
    {
      concurrency: 5, // Process 5 verifications concurrently
    }
  );

  logger.info('Verification worker started');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing verification worker...');
    try {
      await worker.close();
    } catch (err) {
      logger.error({
        msg: 'Error closing verification worker',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

// Export for use in main worker process
export { processVerificationJob };
