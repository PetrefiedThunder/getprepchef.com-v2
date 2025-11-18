import mongoose, { Schema, Document, Model } from 'mongoose';
import { KITCHEN_TYPE, KitchenType } from '@/config/constants';
import { Address } from '@/lib/validators';

/**
 * Kitchen Model
 * Represents a physical kitchen location
 */

export interface IKitchen extends Document {
  _id: mongoose.Types.ObjectId;
  tenant_id: mongoose.Types.ObjectId;
  jurisdiction_id?: mongoose.Types.ObjectId; // Link to regulatory jurisdiction
  name: string;
  address: Address;
  type: KitchenType;
  capacity?: number; // Number of concurrent vendors supported
  status: 'active' | 'inactive';
  metadata?: Record<string, any>; // Custom fields
  created_at: Date;
  updated_at: Date;
}

export interface IKitchenModel extends Model<IKitchen> {
  findByTenant(tenantId: mongoose.Types.ObjectId): Promise<IKitchen[]>;
  findActiveByTenant(tenantId: mongoose.Types.ObjectId): Promise<IKitchen[]>;
}

const AddressSchema = new Schema<Address>(
  {
    street: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    county: {
      type: String,
      default: null,
    },
    state: {
      type: String,
      required: true,
      uppercase: true,
      validate: {
        validator: (v: string) => v.length === 2,
        message: 'State must be 2-letter code',
      },
    },
    zip: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => /^\d{5}(-\d{4})?$/.test(v),
        message: 'Invalid ZIP code format',
      },
    },
    country: {
      type: String,
      default: 'US',
      uppercase: true,
      validate: {
        validator: (v: string) => v.length === 2,
        message: 'Country must be 2-letter code',
      },
    },
  },
  { _id: false }
);

const KitchenSchema = new Schema<IKitchen, IKitchenModel>(
  {
    tenant_id: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    jurisdiction_id: {
      type: Schema.Types.ObjectId,
      ref: 'Jurisdiction',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: AddressSchema,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(KITCHEN_TYPE),
      default: KITCHEN_TYPE.SHARED,
    },
    capacity: {
      type: Number,
      min: 1,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
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
KitchenSchema.index({ tenant_id: 1, status: 1 });
KitchenSchema.index({ 'address.state': 1, 'address.county': 1 });
KitchenSchema.index({ jurisdiction_id: 1 });

// Static method: Find all kitchens for a tenant
KitchenSchema.statics.findByTenant = async function (
  this: IKitchenModel,
  tenantId: mongoose.Types.ObjectId
): Promise<IKitchen[]> {
  return this.find({ tenant_id: tenantId }).sort({ created_at: -1 });
};

// Static method: Find active kitchens for a tenant
KitchenSchema.statics.findActiveByTenant = async function (
  this: IKitchenModel,
  tenantId: mongoose.Types.ObjectId
): Promise<IKitchen[]> {
  return this.find({
    tenant_id: tenantId,
    status: 'active',
  }).sort({ created_at: -1 });
};

// Ensure virtuals are included in JSON
KitchenSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Kitchen = mongoose.model<IKitchen, IKitchenModel>('Kitchen', KitchenSchema);
