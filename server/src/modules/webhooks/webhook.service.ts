import mongoose from 'mongoose';
import axios, { AxiosError } from 'axios';
import { WebhookEndpoint, IWebhookEndpoint } from './webhook_endpoint.model';
import { WebhookDeliveryLog, IWebhookDeliveryLog } from './webhook_delivery_log.model';
import { generateHmacSignature } from '@/lib/crypto';
import { WebhookEvent } from '@/config/constants';
import { NotFoundError } from '@/middleware/error_handler';
import logger from '@/lib/logger';

/**
 * Webhook Service
 * Manages webhook subscriptions and dispatches events
 */

export interface IWebhookPayload {
  event: WebhookEvent;
  tenant_id: string;
  data: Record<string, any>;
  timestamp: string;
}

export class WebhookService {
  /**
   * Create webhook endpoint
   */
  static async createEndpoint(
    tenantId: mongoose.Types.ObjectId,
    url: string,
    events: WebhookEvent[]
  ): Promise<IWebhookEndpoint> {
    logger.info({
      msg: 'Creating webhook endpoint',
      tenant_id: tenantId.toString(),
      url,
      events,
    });

    const endpoint = await WebhookEndpoint.createEndpoint(tenantId, url, events);

    logger.info({
      msg: 'Webhook endpoint created',
      endpoint_id: endpoint._id.toString(),
    });

    return endpoint;
  }

  /**
   * List webhook endpoints for a tenant
   */
  static async listEndpoints(tenantId: mongoose.Types.ObjectId): Promise<IWebhookEndpoint[]> {
    return WebhookEndpoint.findByTenant(tenantId);
  }

  /**
   * Get webhook endpoint by ID
   */
  static async getEndpoint(
    endpointId: string,
    tenantId: mongoose.Types.ObjectId
  ): Promise<IWebhookEndpoint> {
    const endpoint = await WebhookEndpoint.findOne({
      _id: new mongoose.Types.ObjectId(endpointId),
      tenant_id: tenantId,
    });

    if (!endpoint) {
      throw new NotFoundError('WebhookEndpoint');
    }

    return endpoint;
  }

  /**
   * Update webhook endpoint
   */
  static async updateEndpoint(
    endpointId: string,
    tenantId: mongoose.Types.ObjectId,
    updates: {
      url?: string;
      events?: WebhookEvent[];
      status?: string;
      headers?: Record<string, string>;
    }
  ): Promise<IWebhookEndpoint> {
    const endpoint = await this.getEndpoint(endpointId, tenantId);

    if (updates.url) endpoint.url = updates.url;
    if (updates.events) endpoint.events = updates.events;
    if (updates.status) endpoint.status = updates.status as any;
    if (updates.headers) endpoint.headers = updates.headers;

    await endpoint.save();

    logger.info({
      msg: 'Webhook endpoint updated',
      endpoint_id: endpoint._id.toString(),
    });

    return endpoint;
  }

  /**
   * Delete webhook endpoint
   */
  static async deleteEndpoint(
    endpointId: string,
    tenantId: mongoose.Types.ObjectId
  ): Promise<void> {
    const endpoint = await this.getEndpoint(endpointId, tenantId);
    await endpoint.disable();

    logger.info({
      msg: 'Webhook endpoint disabled',
      endpoint_id: endpoint._id.toString(),
    });
  }

  /**
   * Dispatch webhook event to all subscribed endpoints
   */
  static async dispatchEvent(
    tenantId: mongoose.Types.ObjectId,
    event: WebhookEvent,
    data: Record<string, any>
  ): Promise<{ dispatched: number; failed: number }> {
    logger.info({
      msg: 'Dispatching webhook event',
      tenant_id: tenantId.toString(),
      event,
    });

    // Find active endpoints subscribed to this event
    const endpoints = await WebhookEndpoint.findActiveByTenantAndEvent(tenantId, event);

    if (endpoints.length === 0) {
      logger.info({ msg: 'No active endpoints for event', event });
      return { dispatched: 0, failed: 0 };
    }

    const payload: IWebhookPayload = {
      event,
      tenant_id: tenantId.toString(),
      data,
      timestamp: new Date().toISOString(),
    };

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    let dispatched = 0;
    let failed = 0;

    for (const endpoint of endpoints) {
      try {
        await this.deliverWebhook(endpoint, payload, eventId, 1);
        dispatched++;
      } catch (error) {
        logger.error({
          msg: 'Webhook delivery failed',
          endpoint_id: endpoint._id.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
        failed++;
      }
    }

    logger.info({
      msg: 'Webhook event dispatched',
      event,
      dispatched,
      failed,
    });

    return { dispatched, failed };
  }

  /**
   * Deliver webhook to a specific endpoint
   */
  static async deliverWebhook(
    endpoint: IWebhookEndpoint,
    payload: IWebhookPayload,
    eventId: string,
    attemptNumber: number
  ): Promise<IWebhookDeliveryLog> {
    logger.info({
      msg: 'Delivering webhook',
      endpoint_id: endpoint._id.toString(),
      event: payload.event,
      attempt: attemptNumber,
    });

    // Create delivery log
    const deliveryLog = await WebhookDeliveryLog.create({
      webhook_endpoint_id: endpoint._id,
      event_type: payload.event,
      event_id: eventId,
      payload,
      attempt_number: attemptNumber,
    });

    try {
      // Generate HMAC signature
      const payloadString = JSON.stringify(payload);
      const signature = generateHmacSignature(endpoint.secret, payloadString);

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Prep-Signature': signature,
        'X-Prep-Event': payload.event,
        'X-Prep-Delivery-ID': eventId,
        'X-Prep-Attempt': attemptNumber.toString(),
        ...endpoint.headers,
      };

      // Make HTTP request
      const response = await axios.post(endpoint.url, payload, {
        headers,
        timeout: endpoint.retry_config.timeout_ms,
        validateStatus: () => true, // Don't throw on any status
      });

      // Check if successful (2xx status)
      if (response.status >= 200 && response.status < 300) {
        await deliveryLog.markSuccess(
          response.status,
          JSON.stringify(response.data).substring(0, 500)
        );

        await endpoint.recordDeliveryAttempt(true);

        logger.info({
          msg: 'Webhook delivered successfully',
          endpoint_id: endpoint._id.toString(),
          status: response.status,
        });

        return deliveryLog;
      } else {
        // Non-2xx status = failure
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        await deliveryLog.markFailure(errorMsg);

        await endpoint.recordDeliveryAttempt(false);

        // Retry if configured
        if (attemptNumber < endpoint.retry_config.max_retries) {
          const delay = this.calculateRetryDelay(
            attemptNumber,
            endpoint.retry_config.backoff_strategy
          );

          logger.info({
            msg: 'Scheduling webhook retry',
            endpoint_id: endpoint._id.toString(),
            delay_ms: delay,
            next_attempt: attemptNumber + 1,
          });

          // In production, this would enqueue a job with delay
          // For now, we'll just wait and retry synchronously
          await new Promise((resolve) => setTimeout(resolve, delay));
          return await this.deliverWebhook(endpoint, payload, eventId, attemptNumber + 1).catch((err) => {
            logger.error({
              msg: 'Webhook retry failed',
              endpoint_id: endpoint._id.toString(),
              error: err instanceof Error ? err.message : String(err),
            });
            throw err;
          });
        }

        throw new Error(errorMsg);
      }
    } catch (error) {
      const errorMsg =
        error instanceof AxiosError
          ? `Network error: ${error.message}`
          : error instanceof Error
          ? error.message
          : String(error);

      await deliveryLog.markFailure(errorMsg);
      await endpoint.recordDeliveryAttempt(false);

      // Retry if configured and haven't exceeded max retries
      if (attemptNumber < endpoint.retry_config.max_retries) {
        const delay = this.calculateRetryDelay(
          attemptNumber,
          endpoint.retry_config.backoff_strategy
        );

        logger.info({
          msg: 'Scheduling webhook retry after error',
          endpoint_id: endpoint._id.toString(),
          delay_ms: delay,
          next_attempt: attemptNumber + 1,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
        return await this.deliverWebhook(endpoint, payload, eventId, attemptNumber + 1).catch((err) => {
          logger.error({
            msg: 'Webhook retry after error failed',
            endpoint_id: endpoint._id.toString(),
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        });
      }

      logger.error({
        msg: 'Webhook delivery failed permanently',
        endpoint_id: endpoint._id.toString(),
        error: errorMsg,
        attempts: attemptNumber,
      });

      throw error;
    }
  }

  /**
   * Calculate retry delay based on backoff strategy
   */
  private static calculateRetryDelay(
    attemptNumber: number,
    strategy: 'linear' | 'exponential'
  ): number {
    const baseDelay = 1000; // 1 second

    if (strategy === 'exponential') {
      return baseDelay * Math.pow(2, attemptNumber - 1);
    } else {
      return baseDelay * attemptNumber;
    }
  }

  /**
   * Get delivery logs for an endpoint
   */
  static async getDeliveryLogs(
    endpointId: string,
    tenantId: mongoose.Types.ObjectId,
    limit: number = 100
  ): Promise<IWebhookDeliveryLog[]> {
    // Verify endpoint belongs to tenant
    await this.getEndpoint(endpointId, tenantId);

    return WebhookDeliveryLog.findByEndpoint(new mongoose.Types.ObjectId(endpointId), limit);
  }

  /**
   * Pause webhook endpoint
   */
  static async pauseEndpoint(
    endpointId: string,
    tenantId: mongoose.Types.ObjectId
  ): Promise<void> {
    const endpoint = await this.getEndpoint(endpointId, tenantId);
    await endpoint.pause();

    logger.info({
      msg: 'Webhook endpoint paused',
      endpoint_id: endpoint._id.toString(),
    });
  }

  /**
   * Resume webhook endpoint
   */
  static async resumeEndpoint(
    endpointId: string,
    tenantId: mongoose.Types.ObjectId
  ): Promise<void> {
    const endpoint = await this.getEndpoint(endpointId, tenantId);
    await endpoint.resume();

    logger.info({
      msg: 'Webhook endpoint resumed',
      endpoint_id: endpoint._id.toString(),
    });
  }
}
