import mongoose, { Schema, Document, Model } from 'mongoose';
import { WebhookEvent } from '@/config/constants';

/**
 * WebhookDeliveryLog Model
 * Tracks webhook delivery attempts and responses
 */

export interface IWebhookDeliveryLog extends Document {
  _id: mongoose.Types.ObjectId;
  webhook_endpoint_id: mongoose.Types.ObjectId;
  event_type: WebhookEvent;
  event_id: string; // Idempotency key
  payload: Record<string, any>;
  attempt_number: number;
  http_status?: number;
  response_body?: string;
  error_message?: string;
  delivered_at?: Date;
  created_at: Date;

  // Methods
  markSuccess(status: number, responseBody?: string): Promise<void>;
  markFailure(error: string): Promise<void>;
}

export interface IWebhookDeliveryLogModel extends Model<IWebhookDeliveryLog> {
  findByEndpoint(
    endpointId: mongoose.Types.ObjectId,
    limit?: number
  ): Promise<IWebhookDeliveryLog[]>;
  findByEventId(eventId: string): Promise<IWebhookDeliveryLog[]>;
  findFailedDeliveries(): Promise<IWebhookDeliveryLog[]>;
}

const WebhookDeliveryLogSchema = new Schema<IWebhookDeliveryLog, IWebhookDeliveryLogModel>(
  {
    webhook_endpoint_id: {
      type: Schema.Types.ObjectId,
      ref: 'WebhookEndpoint',
      required: true,
      index: true,
    },
    event_type: {
      type: String,
      required: true,
      index: true,
    },
    event_id: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    attempt_number: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    http_status: {
      type: Number,
      min: 100,
      max: 599,
      default: null,
    },
    response_body: {
      type: String,
      default: null,
    },
    error_message: {
      type: String,
      default: null,
    },
    delivered_at: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: false, // Only track creation
    },
  }
);

// Indexes
WebhookDeliveryLogSchema.index({ webhook_endpoint_id: 1, created_at: -1 });
WebhookDeliveryLogSchema.index({ event_id: 1, attempt_number: 1 });
WebhookDeliveryLogSchema.index({ delivered_at: 1 });
WebhookDeliveryLogSchema.index({ http_status: 1 });

// Instance method: Mark delivery as successful
WebhookDeliveryLogSchema.methods.markSuccess = async function (
  this: IWebhookDeliveryLog,
  status: number,
  responseBody?: string
): Promise<void> {
  this.http_status = status;
  this.response_body = responseBody || null;
  this.delivered_at = new Date();
  this.error_message = null;

  await this.save();
};

// Instance method: Mark delivery as failed
WebhookDeliveryLogSchema.methods.markFailure = async function (
  this: IWebhookDeliveryLog,
  error: string
): Promise<void> {
  this.error_message = error;
  this.delivered_at = null;

  await this.save();
};

// Static method: Find deliveries for an endpoint
WebhookDeliveryLogSchema.statics.findByEndpoint = async function (
  this: IWebhookDeliveryLogModel,
  endpointId: mongoose.Types.ObjectId,
  limit: number = 100
): Promise<IWebhookDeliveryLog[]> {
  return this.find({ webhook_endpoint_id: endpointId })
    .sort({ created_at: -1 })
    .limit(limit);
};

// Static method: Find all attempts for an event (by event_id)
WebhookDeliveryLogSchema.statics.findByEventId = async function (
  this: IWebhookDeliveryLogModel,
  eventId: string
): Promise<IWebhookDeliveryLog[]> {
  return this.find({ event_id: eventId }).sort({ attempt_number: 1 });
};

// Static method: Find failed deliveries
WebhookDeliveryLogSchema.statics.findFailedDeliveries = async function (
  this: IWebhookDeliveryLogModel
): Promise<IWebhookDeliveryLog[]> {
  return this.find({
    delivered_at: null,
    error_message: { $ne: null },
  })
    .sort({ created_at: -1 })
    .limit(100);
};

// Ensure virtuals are included in JSON
WebhookDeliveryLogSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    // Truncate response_body if too long
    if (ret.response_body && ret.response_body.length > 500) {
      ret.response_body = ret.response_body.substring(0, 500) + '... (truncated)';
    }
    return ret;
  },
});

export const WebhookDeliveryLog = mongoose.model<
  IWebhookDeliveryLog,
  IWebhookDeliveryLogModel
>('WebhookDeliveryLog', WebhookDeliveryLogSchema);
