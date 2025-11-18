import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * VendorPerson Model
 * Represents owners/principals associated with a vendor
 */

export interface IVendorPerson extends Document {
  _id: mongoose.Types.ObjectId;
  vendor_id: mongoose.Types.ObjectId;
  first_name: string;
  last_name: string;
  role: 'owner' | 'principal' | 'manager';
  ownership_percentage?: number;
  ssn_last4_encrypted?: string; // Last 4 of SSN, encrypted
  date_of_birth?: Date;
  email: string;
  phone: string;
  documents: mongoose.Types.ObjectId[]; // Food handler cards, etc.
  created_at: Date;
  updated_at: Date;

  // Virtual properties
  full_name: string;
}

export interface IVendorPersonModel extends Model<IVendorPerson> {
  findByVendor(vendorId: mongoose.Types.ObjectId): Promise<IVendorPerson[]>;
}

const VendorPersonSchema = new Schema<IVendorPerson, IVendorPersonModel>(
  {
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    first_name: {
      type: String,
      required: true,
      trim: true,
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['owner', 'principal', 'manager'],
      default: 'owner',
    },
    ownership_percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    ssn_last4_encrypted: {
      type: String,
      default: null,
      select: false, // Don't return by default
    },
    date_of_birth: {
      type: Date,
      default: null,
      select: false, // Don't return by default
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v: string) => /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v),
        message: 'Invalid email format',
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
    documents: {
      type: [Schema.Types.ObjectId],
      ref: 'VendorDocument',
      default: [],
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
VendorPersonSchema.index({ vendor_id: 1 });

// Virtual: full_name
VendorPersonSchema.virtual('full_name').get(function (this: IVendorPerson) {
  return `${this.first_name} ${this.last_name}`;
});

// Static method: Find all persons for a vendor
VendorPersonSchema.statics.findByVendor = async function (
  this: IVendorPersonModel,
  vendorId: mongoose.Types.ObjectId
): Promise<IVendorPerson[]> {
  return this.find({ vendor_id: vendorId }).sort({ created_at: 1 });
};

// Validation: Ownership percentages should not exceed 100% total
VendorPersonSchema.pre('save', async function (next) {
  if (this.ownership_percentage !== null && this.ownership_percentage !== undefined) {
    const VendorPerson = this.constructor as IVendorPersonModel;
    const persons = await VendorPerson.find({
      vendor_id: this.vendor_id,
      _id: { $ne: this._id },
    });

    const totalOwnership = persons.reduce(
      (sum, p) => sum + (p.ownership_percentage || 0),
      this.ownership_percentage || 0
    );

    if (totalOwnership > 100) {
      throw new Error('Total ownership percentage cannot exceed 100%');
    }
  }

  next();
});

// Ensure virtuals are included in JSON
VendorPersonSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.ssn_last4_encrypted;
    delete ret.date_of_birth;
    return ret;
  },
});

export const VendorPerson = mongoose.model<IVendorPerson, IVendorPersonModel>(
  'VendorPerson',
  VendorPersonSchema
);
