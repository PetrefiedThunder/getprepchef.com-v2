import mongoose, { Schema, Document, Model } from 'mongoose';
import { Address, Contact } from '@/lib/validators';

/**
 * HealthDept Model
 * Represents a local health department
 */

export interface IHealthDept extends Document {
  _id: mongoose.Types.ObjectId;
  jurisdiction_id: mongoose.Types.ObjectId;
  name: string;
  website?: string;
  contact: Contact & { address?: Address };
  inspection_portal_url?: string;
  api_available: boolean;
  api_config?: {
    endpoint?: string;
    auth_type?: string;
    credentials_encrypted?: string;
  };
  created_at: Date;
  updated_at: Date;
}

export interface IHealthDeptModel extends Model<IHealthDept> {
  findByJurisdiction(jurisdictionId: mongoose.Types.ObjectId): Promise<IHealthDept | null>;
  findWithApiAccess(): Promise<IHealthDept[]>;
}

const AddressSchema = new Schema<Address>(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    county: { type: String, default: null },
    state: { type: String, required: true, uppercase: true },
    zip: { type: String, required: true },
    country: { type: String, default: 'US', uppercase: true },
  },
  { _id: false }
);

const ContactSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      validate: {
        validator: (v: string) => /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v),
      },
    },
    phone: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => /^\+?[1-9]\d{1,14}$/.test(v),
      },
    },
    address: {
      type: AddressSchema,
      default: null,
    },
  },
  { _id: false }
);

const ApiConfigSchema = new Schema(
  {
    endpoint: {
      type: String,
      default: null,
    },
    auth_type: {
      type: String,
      enum: ['api_key', 'oauth', 'basic_auth', 'none'],
      default: 'none',
    },
    credentials_encrypted: {
      type: String,
      default: null,
      select: false, // Never return in responses
    },
  },
  { _id: false }
);

const HealthDeptSchema = new Schema<IHealthDept, IHealthDeptModel>(
  {
    jurisdiction_id: {
      type: Schema.Types.ObjectId,
      ref: 'Jurisdiction',
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    website: {
      type: String,
      default: null,
      validate: {
        validator: (v: string | null) => {
          if (!v) return true;
          try {
            new URL(v);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Invalid URL format',
      },
    },
    contact: {
      type: ContactSchema,
      required: true,
    },
    inspection_portal_url: {
      type: String,
      default: null,
    },
    api_available: {
      type: Boolean,
      default: false,
      index: true,
    },
    api_config: {
      type: ApiConfigSchema,
      default: null,
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
HealthDeptSchema.index({ jurisdiction_id: 1 }, { unique: true });
HealthDeptSchema.index({ api_available: 1 });

// Static method: Find health dept by jurisdiction
HealthDeptSchema.statics.findByJurisdiction = async function (
  this: IHealthDeptModel,
  jurisdictionId: mongoose.Types.ObjectId
): Promise<IHealthDept | null> {
  return this.findOne({ jurisdiction_id: jurisdictionId });
};

// Static method: Find health depts with API access
HealthDeptSchema.statics.findWithApiAccess = async function (
  this: IHealthDeptModel
): Promise<IHealthDept[]> {
  return this.find({ api_available: true });
};

// Ensure virtuals are included in JSON
HealthDeptSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    if (ret.api_config) {
      delete ret.api_config.credentials_encrypted;
    }
    return ret;
  },
});

export const HealthDept = mongoose.model<IHealthDept, IHealthDeptModel>(
  'HealthDept',
  HealthDeptSchema
);
