import mongoose, { Schema, Document, Model } from 'mongoose';
import { WEBHOOK_EVENT, WebhookEvent, WEBHOOK_STATUS, WebhookStatus } from '@/config/constants';
import { generateSecureToken } from '@/lib/crypto';

/**
 * WebhookEndpoint Model
 * Represents a webhook subscription for a tenant
 */

export interface IRetryConfig {
  max_retries: number;
  backoff_strategy: 'linear' | 'exponential';
  timeout_ms: number;
}

export interface IWebhookEndpoint extends Document {
  _id: mongoose.Types.ObjectId;
  tenant_id: mongoose.Types.ObjectId;
  url: string;
  secret: string; // For HMAC signing (stored in plain text - tenant needs it)
  events: WebhookEvent[];
  status: WebhookStatus;
  headers?: Record<string, string>; // Custom headers to send
  retry_config: IRetryConfig;
  last_delivery_attempt_at?: Date;
  last_successful_delivery_at?: Date;
  failure_count: number; // Consecutive failures
  created_at: Date;
  updated_at: Date;

  // Methods
  pause(): Promise<void>;
  resume(): Promise<void>;
  disable(): Promise<void>;
  recordDeliveryAttempt(success: boolean): Promise<void>;
  resetFailureCount(): Promise<void>;
}

export interface IWebhookEndpointModel extends Model<IWebhookEndpoint> {
  findByTenant(tenantId: mongoose.Types.ObjectId): Promise<IWebhookEndpoint[]>;
  findActiveByTenantAndEvent(
    tenantId: mongoose.Types.ObjectId,
    event: WebhookEvent
  ): Promise<IWebhookEndpoint[]>;
  createEndpoint(
    tenantId: mongoose.Types.ObjectId,
    url: string,
    events: WebhookEvent[]
  ): Promise<IWebhookEndpoint>;
}

const RetryConfigSchema = new Schema<IRetryConfig>(
  {
    max_retries: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
      default: 3,
    },
    backoff_strategy: {
      type: String,
      required: true,
      enum: ['linear', 'exponential'],
      default: 'exponential',
    },
    timeout_ms: {
      type: Number,
      required: true,
      min: 1000,
      max: 30000,
      default: 5000,
    },
  },
  { _id: false }
);

const WebhookEndpointSchema = new Schema<IWebhookEndpoint, IWebhookEndpointModel>(
  {
    tenant_id: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => {
          try {
            const url = new URL(v);
            return url.protocol === 'https:' || url.protocol === 'http:';
          } catch {
            return false;
          }
        },
        message: 'Invalid URL format',
      },
    },
    secret: {
      type: String,
      required: true,
    },
    events: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: 'At least one event must be specified',
      },
      enum: Object.values(WEBHOOK_EVENT),
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(WEBHOOK_STATUS),
      default: WEBHOOK_STATUS.ACTIVE,
      index: true,
    },
    headers: {
      type: Schema.Types.Mixed,
      default: {},
    },
    retry_config: {
      type: RetryConfigSchema,
      required: true,
      default: () => ({
        max_retries: 3,
        backoff_strategy: 'exponential',
        timeout_ms: 5000,
      }),
    },
    last_delivery_attempt_at: {
      type: Date,
      default: null,
    },
    last_successful_delivery_at: {
      type: Date,
      default: null,
    },
    failure_count: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

// Indexes
WebhookEndpointSchema.index({ tenant_id: 1, status: 1 });
WebhookEndpointSchema.index({ status: 1, events: 1 });

// Instance method: Pause endpoint
WebhookEndpointSchema.methods.pause = async function (
  this: IWebhookEndpoint
): Promise<void> {
  this.status = WEBHOOK_STATUS.PAUSED;
  await this.save();
};

// Instance method: Resume endpoint
WebhookEndpointSchema.methods.resume = async function (
  this: IWebhookEndpoint
): Promise<void> {
  this.status = WEBHOOK_STATUS.ACTIVE;
  this.failure_count = 0; // Reset on resume
  await this.save();
};

// Instance method: Disable endpoint
WebhookEndpointSchema.methods.disable = async function (
  this: IWebhookEndpoint
): Promise<void> {
  this.status = WEBHOOK_STATUS.DISABLED;
  await this.save();
};

// Instance method: Record delivery attempt
WebhookEndpointSchema.methods.recordDeliveryAttempt = async function (
  this: IWebhookEndpoint,
  success: boolean
): Promise<void> {
  this.last_delivery_attempt_at = new Date();

  if (success) {
    this.last_successful_delivery_at = new Date();
    this.failure_count = 0;
  } else {
    this.failure_count += 1;

    // Auto-disable after too many consecutive failures
    if (this.failure_count >= 50) {
      this.status = WEBHOOK_STATUS.DISABLED;
    }
  }

  await this.save();
};

// Instance method: Reset failure count
WebhookEndpointSchema.methods.resetFailureCount = async function (
  this: IWebhookEndpoint
): Promise<void> {
  this.failure_count = 0;
  await this.save();
};

// Static method: Find all endpoints for a tenant
WebhookEndpointSchema.statics.findByTenant = async function (
  this: IWebhookEndpointModel,
  tenantId: mongoose.Types.ObjectId
): Promise<IWebhookEndpoint[]> {
  return this.find({ tenant_id: tenantId }).sort({ created_at: -1 });
};

// Static method: Find active endpoints for tenant and event
WebhookEndpointSchema.statics.findActiveByTenantAndEvent = async function (
  this: IWebhookEndpointModel,
  tenantId: mongoose.Types.ObjectId,
  event: WebhookEvent
): Promise<IWebhookEndpoint[]> {
  return this.find({
    tenant_id: tenantId,
    status: WEBHOOK_STATUS.ACTIVE,
    events: event,
  });
};

// Static method: Create new endpoint
WebhookEndpointSchema.statics.createEndpoint = async function (
  this: IWebhookEndpointModel,
  tenantId: mongoose.Types.ObjectId,
  url: string,
  events: WebhookEvent[]
): Promise<IWebhookEndpoint> {
  // Generate a secure secret for HMAC signing
  const secret = generateSecureToken(32);

  return this.create({
    tenant_id: tenantId,
    url,
    secret,
    events,
    status: WEBHOOK_STATUS.ACTIVE,
  });
};

// Ensure virtuals are included in JSON
WebhookEndpointSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    // Only show first/last 4 chars of secret for security
    if (ret.secret) {
      const secret = ret.secret as string;
      ret.secret = `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`;
    }
    return ret;
  },
});

export const WebhookEndpoint = mongoose.model<IWebhookEndpoint, IWebhookEndpointModel>(
  'WebhookEndpoint',
  WebhookEndpointSchema
);
