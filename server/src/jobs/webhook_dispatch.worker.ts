import { Job } from 'bullmq';
import mongoose from 'mongoose';
import { createWorker, WebhookDispatchJobData, QUEUE_NAMES } from './queue';
import { WebhookEndpoint } from '@/modules/webhooks/webhook_endpoint.model';
import { WebhookService } from '@/modules/webhooks/webhook.service';
import logger from '@/lib/logger';

/**
 * Webhook Dispatch Worker
 * Processes webhook delivery jobs
 */

async function processWebhookDispatchJob(job: Job<WebhookDispatchJobData>): Promise<void> {
  const { endpoint_id, event_type, event_id, payload, attempt_number } = job.data;

  logger.info({
    msg: 'Processing webhook dispatch job',
    job_id: job.id,
    endpoint_id,
    event_type,
    attempt_number,
  });

  try {
    // Get webhook endpoint
    const endpoint = await WebhookEndpoint.findById(endpoint_id);

    if (!endpoint) {
      logger.warn({
        msg: 'Webhook endpoint not found, skipping',
        endpoint_id,
      });
      return; // Don't retry if endpoint doesn't exist
    }

    // Check if endpoint is active
    if (endpoint.status !== 'active') {
      logger.warn({
        msg: 'Webhook endpoint not active, skipping',
        endpoint_id,
        status: endpoint.status,
      });
      return; // Don't retry if endpoint is paused/disabled
    }

    // Deliver webhook
    await WebhookService.deliverWebhook(
      endpoint,
      payload as any,
      event_id,
      attempt_number
    );

    logger.info({
      msg: 'Webhook delivered successfully',
      job_id: job.id,
      endpoint_id,
      event_type,
    });
  } catch (error) {
    logger.error({
      msg: 'Webhook dispatch job failed',
      job_id: job.id,
      endpoint_id,
      event_type,
      attempt_number,
      error: error instanceof Error ? error.message : String(error),
    });

    // Don't re-throw - let BullMQ retry based on job config
    // The WebhookService already handles retries internally
    // This is just for catastrophic failures
    if (attempt_number >= 3) {
      logger.error({
        msg: 'Webhook dispatch permanently failed after max attempts',
        endpoint_id,
        event_id,
      });
    } else {
      throw error; // Retry
    }
  }
}

/**
 * Start webhook dispatch worker
 */
export function startWebhookDispatchWorker(): void {
  const worker = createWorker<WebhookDispatchJobData>(
    QUEUE_NAMES.WEBHOOK_DISPATCH,
    processWebhookDispatchJob,
    {
      concurrency: 10, // Higher concurrency for webhooks
    }
  );

  logger.info('Webhook dispatch worker started');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing webhook dispatch worker...');
    try {
      await worker.close();
    } catch (err) {
      logger.error({
        msg: 'Error closing webhook dispatch worker',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

// Export for use in main worker process
export { processWebhookDispatchJob };
