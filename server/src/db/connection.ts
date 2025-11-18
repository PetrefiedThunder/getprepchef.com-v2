import mongoose from 'mongoose';
import { config } from '@/config/env';
import logger from '@/lib/logger';

/**
 * MongoDB connection with retry logic and graceful shutdown
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection pooling
 * - Graceful shutdown on SIGINT/SIGTERM
 * - Detailed logging
 */

interface ConnectionOptions {
  maxRetries?: number;
  retryDelay?: number;
}

let isConnected = false;
let connectionAttempts = 0;

/**
 * Connect to MongoDB with retry logic
 */
export async function connectDatabase(
  options: ConnectionOptions = {}
): Promise<typeof mongoose> {
  const { maxRetries = 5, retryDelay = 5000 } = options;

  if (isConnected) {
    logger.warn('Database already connected, skipping connection attempt');
    return mongoose;
  }

  try {
    connectionAttempts++;

    logger.info({
      msg: 'Connecting to MongoDB',
      uri: config.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'), // Redact password
      attempt: connectionAttempts,
      maxRetries,
    });

    await mongoose.connect(config.MONGODB_URI, {
      maxPoolSize: config.MONGODB_MAX_POOL_SIZE,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    connectionAttempts = 0;

    logger.info({
      msg: 'MongoDB connected successfully',
      host: mongoose.connection.host,
      database: mongoose.connection.name,
    });

    // Set up connection event listeners
    setupEventListeners();

    return mongoose;
  } catch (error) {
    logger.error({
      msg: 'MongoDB connection failed',
      error: error instanceof Error ? error.message : String(error),
      attempt: connectionAttempts,
    });

    if (connectionAttempts < maxRetries) {
      const delay = retryDelay * Math.pow(2, connectionAttempts - 1); // Exponential backoff
      logger.info({
        msg: 'Retrying MongoDB connection',
        retryIn: `${delay}ms`,
        attempt: connectionAttempts + 1,
        maxRetries,
      });

      await sleep(delay);
      return connectDatabase(options);
    } else {
      logger.fatal('Max MongoDB connection retries reached, exiting...');
      throw new Error('Failed to connect to MongoDB after maximum retries');
    }
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    logger.warn('Database not connected, skipping disconnection');
    return;
  }

  try {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('MongoDB disconnected successfully');
  } catch (error) {
    logger.error({
      msg: 'Error disconnecting from MongoDB',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Setup MongoDB connection event listeners
 */
function setupEventListeners(): void {
  mongoose.connection.on('connected', () => {
    logger.debug('Mongoose connected to MongoDB');
  });

  mongoose.connection.on('error', (error) => {
    logger.error({
      msg: 'Mongoose connection error',
      error: error.message,
    });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('Mongoose disconnected from MongoDB');
    isConnected = false;
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await gracefulShutdown('SIGINT');
  });

  process.on('SIGTERM', async () => {
    await gracefulShutdown('SIGTERM');
  });
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({
    msg: 'Graceful shutdown initiated',
    signal,
  });

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed through graceful shutdown');
    process.exit(0);
  } catch (error) {
    logger.error({
      msg: 'Error during graceful shutdown',
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

/**
 * Check if database is connected
 */
export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Get database connection health status
 */
export function getDatabaseHealth(): {
  connected: boolean;
  readyState: number;
  host: string;
  database: string;
} {
  return {
    connected: isConnected,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || 'unknown',
    database: mongoose.connection.name || 'unknown',
  };
}

/**
 * Utility: Sleep for given milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
