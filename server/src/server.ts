import { config } from '@/config/env';
import logger from '@/lib/logger';
import { connectDatabase } from '@/db/connection';
import createApp from '@/app';

/**
 * Server entry point
 *
 * Orchestrates:
 * 1. Database connection
 * 2. App initialization
 * 3. HTTP server startup
 * 4. Graceful shutdown
 */

async function start(): Promise<void> {
  try {
    logger.info({
      msg: 'Starting PrepChef server',
      environment: config.NODE_ENV,
      port: config.PORT,
      host: config.HOST,
    });

    // Connect to database
    logger.info('Connecting to database...');
    await connectDatabase();

    // Create and configure app
    logger.info('Initializing Fastify app...');
    const app = await createApp();

    // Start HTTP server
    logger.info('Starting HTTP server...');
    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info({
      msg: '🚀 PrepChef server started successfully',
      url: `http://${config.HOST}:${config.PORT}`,
      environment: config.NODE_ENV,
    });

    // Graceful shutdown handler
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info({
          msg: 'Shutdown signal received',
          signal,
        });

        try {
          logger.info('Closing HTTP server...');
          await app.close();

          logger.info('Server shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error({
            msg: 'Error during shutdown',
            error: error instanceof Error ? error.message : String(error),
          });
          process.exit(1);
        }
      });
    });
  } catch (error) {
    logger.fatal({
      msg: 'Failed to start server',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    msg: 'Unhandled promise rejection',
    reason,
    promise,
  });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.fatal({
    msg: 'Uncaught exception',
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Start the server
start();
