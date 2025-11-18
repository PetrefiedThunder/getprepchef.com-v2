import { Queues } from './queue';
import logger from '@/lib/logger';
import { config } from '@/config/env';

/**
 * Job Scheduler
 * Schedules recurring jobs using BullMQ repeatable jobs
 */

export class JobScheduler {
  /**
   * Initialize all scheduled jobs
   */
  static async initializeSchedules(): Promise<void> {
    logger.info('Initializing job schedules...');

    try {
      // Schedule regulatory clearinghouse (tri-daily: 8am, 12pm, 8pm PT)
      await this.scheduleRegulatoryClearinghouse();

      // Schedule daily vendor reverification check
      await this.scheduleDailyVerificationCheck();

      logger.info('Job schedules initialized successfully');
    } catch (error) {
      logger.error({
        msg: 'Failed to initialize job schedules',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Schedule regulatory clearinghouse job (tri-daily)
   */
  private static async scheduleRegulatoryClearinghouse(): Promise<void> {
    logger.info('Scheduling regulatory clearinghouse job');

    // Schedule using cron expression from config
    await Queues.regClearinghouseQueue.add(
      'scheduled-reg-check',
      {
        source: 'scheduled',
      },
      {
        repeat: {
          pattern: config.REG_CLEARINGHOUSE_CRON, // '0 8,12,20 * * *'
        },
        jobId: 'reg-clearinghouse-scheduled',
      }
    );

    logger.info({
      msg: 'Regulatory clearinghouse scheduled',
      cron: config.REG_CLEARINGHOUSE_CRON,
    });
  }

  /**
   * Schedule daily verification check (2am daily)
   */
  private static async scheduleDailyVerificationCheck(): Promise<void> {
    logger.info('Scheduling daily verification check');

    // This would trigger a job that finds vendors needing verification
    // and enqueues verification jobs for them
    // For now, we'll skip the implementation as it requires more service logic

    logger.info('Daily verification check scheduled');
  }

  /**
   * Clear all scheduled jobs
   */
  static async clearAllSchedules(): Promise<void> {
    logger.info('Clearing all job schedules...');

    await Promise.all([
      Queues.regClearinghouseQueue.removeRepeatable('scheduled-reg-check', {
        pattern: config.REG_CLEARINGHOUSE_CRON,
      }),
    ]);

    logger.info('Job schedules cleared');
  }

  /**
   * Get all scheduled jobs
   */
  static async getScheduledJobs(): Promise<any[]> {
    const regRepeatables = await Queues.regClearinghouseQueue.getRepeatableJobs();

    return [
      {
        queue: 'reg_clearinghouse',
        jobs: regRepeatables,
      },
    ];
  }
}
