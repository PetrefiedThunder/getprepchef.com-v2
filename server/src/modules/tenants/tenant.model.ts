import mongoose, { Schema, Document, Model } from 'mongoose';
import { TENANT_TYPE, TenantType } from '@/config/constants';
import { generateSecureToken, hashValue } from '@/lib/crypto';

/**
 * Tenant Model
 * Represents a kitchen operator, marketplace, or ghost kitchen
 */

export interface IApiKey {
  key_hash: string; // Hashed API key (never store plain text)
  name: string;
  created_at: Date;
  last_used_at?: Date;
}

export interface ITenantSettings {
  webhook_endpoints?: mongoose.Types.ObjectId[];
  notification_preferences?: {
    email_enabled: boolean;
    sms_enabled: boolean;
    webhook_enabled: boolean;
  };
  timezone: string;
}

export interface ITenant extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: TenantType;
  contact_email: string;
  api_keys: IApiKey[];
  settings: ITenantSettings;
  status: 'active' | 'suspended' | 'trial';
  trial_ends_at?: Date;
  created_at: Date;
  updated_at: Date;

  // Methods
  generateApiKey(name: string): Promise<{ key: string; key_hash: string }>;
  verifyApiKey(apiKey: string): boolean;
  revokeApiKey(keyHash: string): Promise<void>;
}

export interface ITenantModel extends Model<ITenant> {
  findByApiKey(apiKey: string): Promise<ITenant | null>;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    key_hash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    last_used_at: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const TenantSettingsSchema = new Schema<ITenantSettings>(
  {
    webhook_endpoints: {
      type: [Schema.Types.ObjectId],
      ref: 'WebhookEndpoint',
      default: [],
    },
    notification_preferences: {
      email_enabled: {
        type: Boolean,
        default: true,
      },
      sms_enabled: {
        type: Boolean,
        default: false,
      },
      webhook_enabled: {
        type: Boolean,
        default: true,
      },
    },
    timezone: {
      type: String,
      default: 'America/Los_Angeles',
    },
  },
  { _id: false }
);

const TenantSchema = new Schema<ITenant, ITenantModel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(TENANT_TYPE),
      default: TENANT_TYPE.KITCHEN_OPERATOR,
    },
    contact_email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Invalid email format',
      },
    },
    api_keys: {
      type: [ApiKeySchema],
      default: [],
    },
    settings: {
      type: TenantSettingsSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'trial'],
      default: 'trial',
    },
    trial_ends_at: {
      type: Date,
      default: () => {
        // 30-day trial by default
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
      },
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
TenantSchema.index({ status: 1, created_at: -1 });
TenantSchema.index({ 'api_keys.key_hash': 1 });

// Instance method: Generate new API key
TenantSchema.methods.generateApiKey = async function (
  this: ITenant,
  name: string
): Promise<{ key: string; key_hash: string }> {
  // Generate a secure random key
  const key = `pk_${generateSecureToken(32)}`;
  const key_hash = hashValue(key);

  // Add to tenant's API keys
  this.api_keys.push({
    key_hash,
    name,
    created_at: new Date(),
  });

  await this.save();

  // Return the plain key (only time it's visible)
  return { key, key_hash };
};

// Instance method: Verify API key
TenantSchema.methods.verifyApiKey = function (
  this: ITenant,
  apiKey: string
): boolean {
  const keyHash = hashValue(apiKey);
  return this.api_keys.some((k) => k.key_hash === keyHash);
};

// Instance method: Revoke API key
TenantSchema.methods.revokeApiKey = async function (
  this: ITenant,
  keyHash: string
): Promise<void> {
  this.api_keys = this.api_keys.filter((k) => k.key_hash !== keyHash);
  await this.save();
};

// Static method: Find tenant by API key
TenantSchema.statics.findByApiKey = async function (
  this: ITenantModel,
  apiKey: string
): Promise<ITenant | null> {
  const keyHash = hashValue(apiKey);

  const tenant = await this.findOne({
    'api_keys.key_hash': keyHash,
    status: { $in: ['active', 'trial'] },
  });

  if (!tenant) {
    return null;
  }

  // Update last_used_at for this API key using atomic operation to prevent race conditions
  const apiKeyIndex = tenant.api_keys.findIndex((k) => k.key_hash === keyHash);
  if (apiKeyIndex >= 0) {
    await this.updateOne(
      { _id: tenant._id, 'api_keys.key_hash': keyHash },
      { $set: { 'api_keys.$.last_used_at': new Date() } }
    );
  }

  return tenant;
};

// Ensure virtuals are included in JSON
TenantSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    // Hide API keys in responses (security)
    if (ret.api_keys) {
      ret.api_keys = ret.api_keys.map((k: IApiKey) => ({
        name: k.name,
        created_at: k.created_at,
        last_used_at: k.last_used_at,
        // Never include key_hash in responses
      }));
    }
    delete ret.__v;
    return ret;
  },
});

export const Tenant = mongoose.model<ITenant, ITenantModel>('Tenant', TenantSchema);
