import { Queue, QueueOptions, Worker, WorkerOptions, Job } from 'bullmq';
import { config } from '@/config/env';
import logger from '@/lib/logger';

/**
 * BullMQ Queue Setup
 * Centralized queue configuration and management
 */

/**
 * Redis connection configuration
 */
const redisConnection = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
};

/**
 * Default queue options
 */
const defaultQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

/**
 * Default worker options
 */
const defaultWorkerOptions: WorkerOptions = {
  connection: redisConnection,
  concurrency: 5,
  lockDuration: 30000, // 30 seconds
};

/**
 * Queue names
 */
export const QUEUE_NAMES = {
  VERIFICATION: 'verification',
  WEBHOOK_DISPATCH: 'webhook-dispatch',
  REG_CLEARINGHOUSE: 'reg-clearinghouse',
  NOTIFICATIONS: 'notifications',
} as const;

/**
 * Job data types
 */
export interface VerificationJobData {
  vendor_id: string;
  tenant_id: string;
  triggered_by: string;
  user_id?: string;
}

export interface WebhookDispatchJobData {
  endpoint_id: string;
  event_type: string;
  event_id: string;
  payload: Record<string, any>;
  attempt_number: number;
}

export interface RegClearinghouseJobData {
  jurisdiction_id?: string;
  source: string;
}

export interface NotificationJobData {
  tenant_id: string;
  user_id?: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}

/**
 * Queue instances
 */
export class Queues {
  public static verificationQueue: Queue<VerificationJobData>;
  public static webhookDispatchQueue: Queue<WebhookDispatchJobData>;
  public static regClearinghouseQueue: Queue<RegClearinghouseJobData>;
  public static notificationsQueue: Queue<NotificationJobData>;

  /**
   * Initialize all queues
   */
  static async initialize(): Promise<void> {
    logger.info('Initializing job queues...');

    try {
      this.verificationQueue = new Queue<VerificationJobData>(
        QUEUE_NAMES.VERIFICATION,
        defaultQueueOptions
      );

      this.webhookDispatchQueue = new Queue<WebhookDispatchJobData>(
        QUEUE_NAMES.WEBHOOK_DISPATCH,
        defaultQueueOptions
      );

      this.regClearinghouseQueue = new Queue<RegClearinghouseJobData>(
        QUEUE_NAMES.REG_CLEARINGHOUSE,
        defaultQueueOptions
      );

      this.notificationsQueue = new Queue<NotificationJobData>(
        QUEUE_NAMES.NOTIFICATIONS,
        defaultQueueOptions
      );

      logger.info('Job queues initialized successfully');
    } catch (error) {
      logger.error({
        msg: 'Failed to initialize queues',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Close all queues
   */
  static async close(): Promise<void> {
    logger.info('Closing job queues...');

    await Promise.all([
      this.verificationQueue?.close(),
      this.webhookDispatchQueue?.close(),
      this.regClearinghouseQueue?.close(),
      this.notificationsQueue?.close(),
    ]);

    logger.info('Job queues closed');
  }

  /**
   * Add verification job
   */
  static async addVerificationJob(data: VerificationJobData): Promise<Job<VerificationJobData>> {
    logger.info({
      msg: 'Adding verification job',
      vendor_id: data.vendor_id,
    });

    return this.verificationQueue.add('verify-vendor', data, {
      jobId: `verify-${data.vendor_id}-${Date.now()}`,
    });
  }

  /**
   * Add webhook dispatch job
   */
  static async addWebhookDispatchJob(
    data: WebhookDispatchJobData,
    delayMs?: number
  ): Promise<Job<WebhookDispatchJobData>> {
    logger.info({
      msg: 'Adding webhook dispatch job',
      endpoint_id: data.endpoint_id,
      event: data.event_type,
      delay: delayMs,
    });

    return this.webhookDispatchQueue.add('dispatch-webhook', data, {
      jobId: `webhook-${data.event_id}-${data.attempt_number}`,
      delay: delayMs,
    });
  }

  /**
   * Add regulatory clearinghouse job
   */
  static async addRegClearinghouseJob(
    data: RegClearinghouseJobData
  ): Promise<Job<RegClearinghouseJobData>> {
    logger.info({
      msg: 'Adding regulatory clearinghouse job',
      jurisdiction_id: data.jurisdiction_id,
    });

    return this.regClearinghouseQueue.add('process-reg-updates', data);
  }

  /**
   * Add notification job
   */
  static async addNotificationJob(
    data: NotificationJobData
  ): Promise<Job<NotificationJobData>> {
    logger.info({
      msg: 'Adding notification job',
      tenant_id: data.tenant_id,
      type: data.type,
    });

    return this.notificationsQueue.add('send-notification', data);
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats(): Promise<Record<string, any>> {
    const [
      verificationCounts,
      webhookCounts,
      regCounts,
      notificationCounts,
    ] = await Promise.all([
      this.verificationQueue.getJobCounts(),
      this.webhookDispatchQueue.getJobCounts(),
      this.regClearinghouseQueue.getJobCounts(),
      this.notificationsQueue.getJobCounts(),
    ]);

    return {
      verification: verificationCounts,
      webhook_dispatch: webhookCounts,
      reg_clearinghouse: regCounts,
      notifications: notificationCounts,
    };
  }
}

/**
 * Create worker with default options
 */
export function createWorker<T>(
  queueName: string,
  processor: (job: Job<T>) => Promise<any>,
  options?: Partial<WorkerOptions>
): Worker<T> {
  const workerOptions: WorkerOptions = {
    ...defaultWorkerOptions,
    ...options,
  };

  const worker = new Worker<T>(queueName, processor, workerOptions);

  // Event listeners
  worker.on('completed', (job) => {
    logger.info({
      msg: 'Job completed',
      queue: queueName,
      job_id: job.id,
      name: job.name,
    });
  });

  worker.on('failed', (job, error) => {
    logger.error({
      msg: 'Job failed',
      queue: queueName,
      job_id: job?.id,
      name: job?.name,
      error: error.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (error) => {
    logger.error({
      msg: 'Worker error',
      queue: queueName,
      error: error.message,
    });
  });

  logger.info({
    msg: 'Worker created',
    queue: queueName,
    concurrency: workerOptions.concurrency,
  });

  return worker;
}
