import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  DOCUMENT_TYPE,
  DocumentType,
  DOCUMENT_STATUS,
  DocumentStatus,
} from '@/config/constants';

/**
 * VendorDocument Model
 * Represents documents uploaded by vendors (licenses, permits, insurance, etc.)
 */

export interface IFileMetadata {
  storage_key: string; // S3 key or local file path
  filename: string;
  mimetype: string;
  size_bytes: number;
  uploaded_at: Date;
}

export interface IVendorDocument extends Document {
  _id: mongoose.Types.ObjectId;
  vendor_id: mongoose.Types.ObjectId;
  vendor_person_id?: mongoose.Types.ObjectId; // Optional: if person-specific (food handler card)
  document_type: DocumentType;
  file_metadata: IFileMetadata;
  status: DocumentStatus;
  issue_date?: Date;
  expiration_date?: Date;
  issuing_authority?: string;
  document_number?: string; // License number, permit number, etc.
  verification_notes?: string;
  verified_by?: mongoose.Types.ObjectId; // User who verified
  verified_at?: Date;
  created_at: Date;
  updated_at: Date;

  // Methods
  isExpired(): boolean;
  isExpiring(daysThreshold: number): boolean;
  approve(userId: mongoose.Types.ObjectId, notes?: string): Promise<void>;
  reject(userId: mongoose.Types.ObjectId, notes: string): Promise<void>;
}

export interface IVendorDocumentModel extends Model<IVendorDocument> {
  findByVendor(vendorId: mongoose.Types.ObjectId): Promise<IVendorDocument[]>;
  findExpiring(daysThreshold: number): Promise<IVendorDocument[]>;
  findExpired(): Promise<IVendorDocument[]>;
}

const FileMetadataSchema = new Schema<IFileMetadata>(
  {
    storage_key: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size_bytes: {
      type: Number,
      required: true,
      min: 0,
    },
    uploaded_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const VendorDocumentSchema = new Schema<IVendorDocument, IVendorDocumentModel>(
  {
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    vendor_person_id: {
      type: Schema.Types.ObjectId,
      ref: 'VendorPerson',
      default: null,
      index: true,
    },
    document_type: {
      type: String,
      required: true,
      enum: Object.values(DOCUMENT_TYPE),
    },
    file_metadata: {
      type: FileMetadataSchema,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(DOCUMENT_STATUS),
      default: DOCUMENT_STATUS.PENDING_REVIEW,
    },
    issue_date: {
      type: Date,
      default: null,
    },
    expiration_date: {
      type: Date,
      default: null,
      index: true,
    },
    issuing_authority: {
      type: String,
      default: null,
    },
    document_number: {
      type: String,
      default: null,
    },
    verification_notes: {
      type: String,
      default: null,
    },
    verified_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verified_at: {
      type: Date,
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
VendorDocumentSchema.index({ vendor_id: 1, document_type: 1 });
VendorDocumentSchema.index({ status: 1 });
VendorDocumentSchema.index({ expiration_date: 1 }, { sparse: true });

// Instance method: Check if document is expired
VendorDocumentSchema.methods.isExpired = function (this: IVendorDocument): boolean {
  if (!this.expiration_date) {
    return false;
  }
  return this.expiration_date.getTime() < Date.now();
};

// Instance method: Check if document is expiring within threshold
VendorDocumentSchema.methods.isExpiring = function (
  this: IVendorDocument,
  daysThreshold: number
): boolean {
  if (!this.expiration_date) {
    return false;
  }

  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;
  const timeUntilExpiry = this.expiration_date.getTime() - Date.now();

  return timeUntilExpiry > 0 && timeUntilExpiry <= thresholdMs;
};

// Instance method: Approve document
VendorDocumentSchema.methods.approve = async function (
  this: IVendorDocument,
  userId: mongoose.Types.ObjectId,
  notes?: string
): Promise<void> {
  this.status = DOCUMENT_STATUS.APPROVED;
  this.verified_by = userId;
  this.verified_at = new Date();

  if (notes) {
    this.verification_notes = notes;
  }

  await this.save();
};

// Instance method: Reject document
VendorDocumentSchema.methods.reject = async function (
  this: IVendorDocument,
  userId: mongoose.Types.ObjectId,
  notes: string
): Promise<void> {
  this.status = DOCUMENT_STATUS.REJECTED;
  this.verified_by = userId;
  this.verified_at = new Date();
  this.verification_notes = notes;

  await this.save();
};

// Static method: Find documents by vendor
VendorDocumentSchema.statics.findByVendor = async function (
  this: IVendorDocumentModel,
  vendorId: mongoose.Types.ObjectId
): Promise<IVendorDocument[]> {
  return this.find({ vendor_id: vendorId }).sort({ created_at: -1 });
};

// Static method: Find expiring documents
VendorDocumentSchema.statics.findExpiring = async function (
  this: IVendorDocumentModel,
  daysThreshold: number
): Promise<IVendorDocument[]> {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  return this.find({
    expiration_date: {
      $lte: thresholdDate,
      $gt: new Date(),
    },
    status: DOCUMENT_STATUS.APPROVED,
  }).populate('vendor_id', 'business_name contact');
};

// Static method: Find expired documents
VendorDocumentSchema.statics.findExpired = async function (
  this: IVendorDocumentModel
): Promise<IVendorDocument[]> {
  return this.find({
    expiration_date: { $lt: new Date() },
    status: DOCUMENT_STATUS.APPROVED,
  }).populate('vendor_id', 'business_name contact');
};

// Ensure virtuals are included in JSON
VendorDocumentSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const VendorDocument = mongoose.model<IVendorDocument, IVendorDocumentModel>(
  'VendorDocument',
  VendorDocumentSchema
);
