import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  VENDOR_STATUS,
  VendorStatus,
  LEGAL_ENTITY_TYPE,
  LegalEntityType,
} from '@/config/constants';
import { Address, Contact } from '@/lib/validators';

/**
 * Vendor Model
 * Represents a food entrepreneur / small business operating in a kitchen
 */

export interface IVendor extends Document {
  _id: mongoose.Types.ObjectId;
  tenant_id: mongoose.Types.ObjectId;
  kitchen_id: mongoose.Types.ObjectId;
  business_name: string;
  dba_name?: string; // Doing Business As
  legal_entity_type: LegalEntityType;
  tax_id_encrypted?: string; // EIN/SSN encrypted
  business_address: Address;
  contact: Contact;
  status: VendorStatus;
  verification_status_updated_at?: Date;
  current_verification_run_id?: mongoose.Types.ObjectId;
  last_verified_at?: Date;
  persons: mongoose.Types.ObjectId[]; // VendorPerson references
  documents: mongoose.Types.ObjectId[]; // VendorDocument references
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;

  // Methods
  updateStatus(newStatus: VendorStatus): Promise<void>;
  isCompliant(): boolean;
}

export interface IVendorModel extends Model<IVendor> {
  findByTenant(
    tenantId: mongoose.Types.ObjectId,
    filters?: Partial<{ status: VendorStatus; kitchen_id: string }>
  ): Promise<IVendor[]>;
  findExpiring(daysThreshold: number): Promise<IVendor[]>;
}

const AddressSchema = new Schema<Address>(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    county: { type: String, default: null },
    state: {
      type: String,
      required: true,
      uppercase: true,
      validate: { validator: (v: string) => v.length === 2 },
    },
    zip: {
      type: String,
      required: true,
      validate: { validator: (v: string) => /^\d{5}(-\d{4})?$/.test(v) },
    },
    country: { type: String, default: 'US', uppercase: true },
  },
  { _id: false }
);

const ContactSchema = new Schema<Contact>(
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
        message: 'Phone must be in E.164 format',
      },
    },
    primary_contact_name: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const VendorSchema = new Schema<IVendor, IVendorModel>(
  {
    tenant_id: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    kitchen_id: {
      type: Schema.Types.ObjectId,
      ref: 'Kitchen',
      required: true,
      index: true,
    },
    business_name: {
      type: String,
      required: true,
      trim: true,
    },
    dba_name: {
      type: String,
      trim: true,
      default: null,
    },
    legal_entity_type: {
      type: String,
      required: true,
      enum: Object.values(LEGAL_ENTITY_TYPE),
    },
    tax_id_encrypted: {
      type: String,
      default: null,
      select: false, // Don't return by default
    },
    business_address: {
      type: AddressSchema,
      required: true,
    },
    contact: {
      type: ContactSchema,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(VENDOR_STATUS),
      default: VENDOR_STATUS.PENDING,
      index: true,
    },
    verification_status_updated_at: {
      type: Date,
      default: null,
    },
    current_verification_run_id: {
      type: Schema.Types.ObjectId,
      ref: 'VerificationRun',
      default: null,
    },
    last_verified_at: {
      type: Date,
      default: null,
    },
    persons: {
      type: [Schema.Types.ObjectId],
      ref: 'VendorPerson',
      default: [],
    },
    documents: {
      type: [Schema.Types.ObjectId],
      ref: 'VendorDocument',
      default: [],
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
VendorSchema.index({ tenant_id: 1, status: 1 });
VendorSchema.index({ kitchen_id: 1 });
VendorSchema.index({ status: 1, last_verified_at: 1 });
VendorSchema.index({ business_name: 'text' }); // Text search

// Instance method: Update status
VendorSchema.methods.updateStatus = async function (
  this: IVendor,
  newStatus: VendorStatus
): Promise<void> {
  this.status = newStatus;
  this.verification_status_updated_at = new Date();

  if (newStatus === VENDOR_STATUS.VERIFIED) {
    this.last_verified_at = new Date();
  }

  await this.save();
};

// Instance method: Check if vendor is compliant
VendorSchema.methods.isCompliant = function (this: IVendor): boolean {
  return this.status === VENDOR_STATUS.VERIFIED;
};

// Static method: Find vendors by tenant
VendorSchema.statics.findByTenant = async function (
  this: IVendorModel,
  tenantId: mongoose.Types.ObjectId,
  filters?: Partial<{ status: VendorStatus; kitchen_id: string }>
): Promise<IVendor[]> {
  const query: any = { tenant_id: tenantId };

  if (filters?.status) {
    query.status = filters.status;
  }

  if (filters?.kitchen_id) {
    query.kitchen_id = new mongoose.Types.ObjectId(filters.kitchen_id);
  }

  return this.find(query)
    .populate('kitchen_id', 'name address')
    .sort({ created_at: -1 });
};

// Static method: Find vendors with expiring documents
VendorSchema.statics.findExpiring = async function (
  this: IVendorModel,
  daysThreshold: number
): Promise<IVendor[]> {
  // This will be implemented with document expiration logic
  // For now, return empty array
  // TODO: Join with VendorDocument collection to find expiring docs
  return [];
};

// Pre-save hook: Set verification_status_updated_at when status changes
VendorSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.verification_status_updated_at = new Date();
  }
  next();
});

// Ensure virtuals are included in JSON
VendorSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.tax_id_encrypted; // Never expose encrypted tax ID
    return ret;
  },
});

export const Vendor = mongoose.model<IVendor, IVendorModel>('Vendor', VendorSchema);
