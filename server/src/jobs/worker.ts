import { config } from '@/config/env';
import logger from '@/lib/logger';
import { connectDatabase } from '@/db/connection';
import { Queues } from './queue';
import { startVerificationWorker } from './verification.worker';
import { startWebhookDispatchWorker } from './webhook_dispatch.worker';
import { startRegClearinghouseWorker } from './reg_clearinghouse.worker';
import { JobScheduler } from './scheduler';

/**
 * Worker Process Entry Point
 * Starts all background job workers
 *
 * Usage: npm run worker
 */

async function startWorkers(): Promise<void> {
  try {
    logger.info({
      msg: 'Starting PrepChef background workers',
      environment: config.NODE_ENV,
    });

    // Connect to database
    logger.info('Connecting to database...');
    await connectDatabase();

    // Initialize queues
    logger.info('Initializing job queues...');
    await Queues.initialize();

    // Start all workers
    logger.info('Starting workers...');
    startVerificationWorker();
    startWebhookDispatchWorker();
    startRegClearinghouseWorker();

    // Initialize scheduled jobs
    logger.info('Initializing job schedules...');
    await JobScheduler.initializeSchedules();

    logger.info({
      msg: '✅ All workers started successfully',
      workers: ['verification', 'webhook_dispatch', 'reg_clearinghouse'],
    });

    // Log queue stats every minute
    setInterval(async () => {
      const stats = await Queues.getQueueStats();
      logger.info({
        msg: 'Queue statistics',
        ...stats,
      });
    }, 60000);
  } catch (error) {
    logger.fatal({
      msg: 'Failed to start workers',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down workers...');

  try {
    await Queues.close();
    logger.info('Workers shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error({
      msg: 'Error during shutdown',
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Handle signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    msg: 'Unhandled promise rejection',
    reason,
    promise,
  });
});

process.on('uncaughtException', (error) => {
  logger.fatal({
    msg: 'Uncaught exception',
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Start workers
startWorkers();
