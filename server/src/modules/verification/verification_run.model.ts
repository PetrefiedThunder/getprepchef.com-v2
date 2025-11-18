import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  VERIFICATION_RUN_STATUS,
  VerificationRunStatus,
  VERIFICATION_OUTCOME,
  VerificationOutcome,
  VERIFICATION_TRIGGER,
  VerificationTrigger,
  CHECKLIST_ITEM_STATUS,
  ChecklistItemStatus,
} from '@/config/constants';

/**
 * VerificationRun Model
 * Represents a single verification evaluation event for a vendor
 */

export interface IValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface IChecklistItem {
  requirement_id: mongoose.Types.ObjectId;
  requirement_name: string;
  requirement_type: string;
  status: ChecklistItemStatus;
  associated_document_id?: mongoose.Types.ObjectId;
  notes?: string;
}

export interface IVerificationChecklist {
  items: IChecklistItem[];
  total_items: number;
  satisfied_items: number;
  completion_percentage: number;
}

export interface IVerificationRun extends Document {
  _id: mongoose.Types.ObjectId;
  vendor_id: mongoose.Types.ObjectId;
  tenant_id: mongoose.Types.ObjectId;
  triggered_by: VerificationTrigger;
  triggered_by_user_id?: mongoose.Types.ObjectId;
  status: VerificationRunStatus;
  checklist: IVerificationChecklist;
  outcome?: VerificationOutcome;
  outcome_reason?: string;
  validation_errors: IValidationError[];
  started_at: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;

  // Methods
  complete(outcome: VerificationOutcome, reason?: string): Promise<void>;
  fail(error: string): Promise<void>;
  addValidationError(field: string, message: string, severity?: 'error' | 'warning'): void;
}

export interface IVerificationRunModel extends Model<IVerificationRun> {
  findByVendor(vendorId: mongoose.Types.ObjectId): Promise<IVerificationRun[]>;
  findLatestByVendor(vendorId: mongoose.Types.ObjectId): Promise<IVerificationRun | null>;
  findPendingRuns(): Promise<IVerificationRun[]>;
}

const ValidationErrorSchema = new Schema<IValidationError>(
  {
    field: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['error', 'warning'],
      default: 'error',
    },
  },
  { _id: false }
);

const ChecklistItemSchema = new Schema<IChecklistItem>(
  {
    requirement_id: {
      type: Schema.Types.ObjectId,
      ref: 'RegRequirement',
      required: true,
    },
    requirement_name: {
      type: String,
      required: true,
    },
    requirement_type: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(CHECKLIST_ITEM_STATUS),
    },
    associated_document_id: {
      type: Schema.Types.ObjectId,
      ref: 'VendorDocument',
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const VerificationChecklistSchema = new Schema<IVerificationChecklist>(
  {
    items: {
      type: [ChecklistItemSchema],
      default: [],
    },
    total_items: {
      type: Number,
      required: true,
      default: 0,
    },
    satisfied_items: {
      type: Number,
      required: true,
      default: 0,
    },
    completion_percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  { _id: false }
);

const VerificationRunSchema = new Schema<IVerificationRun, IVerificationRunModel>(
  {
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    tenant_id: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    triggered_by: {
      type: String,
      required: true,
      enum: Object.values(VERIFICATION_TRIGGER),
    },
    triggered_by_user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(VERIFICATION_RUN_STATUS),
      default: VERIFICATION_RUN_STATUS.RUNNING,
      index: true,
    },
    checklist: {
      type: VerificationChecklistSchema,
      required: true,
    },
    outcome: {
      type: String,
      enum: Object.values(VERIFICATION_OUTCOME),
      default: null,
    },
    outcome_reason: {
      type: String,
      default: null,
    },
    validation_errors: {
      type: [ValidationErrorSchema],
      default: [],
    },
    started_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completed_at: {
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
VerificationRunSchema.index({ vendor_id: 1, created_at: -1 });
VerificationRunSchema.index({ status: 1, created_at: -1 });
VerificationRunSchema.index({ tenant_id: 1, status: 1 });

// Instance method: Complete verification run
VerificationRunSchema.methods.complete = async function (
  this: IVerificationRun,
  outcome: VerificationOutcome,
  reason?: string
): Promise<void> {
  this.status = VERIFICATION_RUN_STATUS.COMPLETED;
  this.outcome = outcome;
  this.outcome_reason = reason || null;
  this.completed_at = new Date();

  await this.save();
};

// Instance method: Fail verification run
VerificationRunSchema.methods.fail = async function (
  this: IVerificationRun,
  error: string
): Promise<void> {
  this.status = VERIFICATION_RUN_STATUS.FAILED;
  this.outcome_reason = error;
  this.completed_at = new Date();

  await this.save();
};

// Instance method: Add validation error
VerificationRunSchema.methods.addValidationError = function (
  this: IVerificationRun,
  field: string,
  message: string,
  severity: 'error' | 'warning' = 'error'
): void {
  this.validation_errors.push({
    field,
    message,
    severity,
  });
};

// Static method: Find all runs for a vendor
VerificationRunSchema.statics.findByVendor = async function (
  this: IVerificationRunModel,
  vendorId: mongoose.Types.ObjectId
): Promise<IVerificationRun[]> {
  return this.find({ vendor_id: vendorId })
    .sort({ created_at: -1 })
    .limit(50); // Last 50 runs
};

// Static method: Find latest run for a vendor
VerificationRunSchema.statics.findLatestByVendor = async function (
  this: IVerificationRunModel,
  vendorId: mongoose.Types.ObjectId
): Promise<IVerificationRun | null> {
  return this.findOne({ vendor_id: vendorId }).sort({ created_at: -1 });
};

// Static method: Find pending runs
VerificationRunSchema.statics.findPendingRuns = async function (
  this: IVerificationRunModel
): Promise<IVerificationRun[]> {
  return this.find({
    status: VERIFICATION_RUN_STATUS.RUNNING,
  }).sort({ created_at: 1 });
};

// Pre-save hook: Calculate checklist completion
VerificationRunSchema.pre('save', function (next) {
  if (this.checklist && this.checklist.items) {
    this.checklist.total_items = this.checklist.items.length;
    this.checklist.satisfied_items = this.checklist.items.filter(
      (item) => item.status === CHECKLIST_ITEM_STATUS.SATISFIED
    ).length;

    if (this.checklist.total_items > 0) {
      this.checklist.completion_percentage = Math.round(
        (this.checklist.satisfied_items / this.checklist.total_items) * 100
      );
    } else {
      this.checklist.completion_percentage = 0;
    }
  }

  next();
});

// Ensure virtuals are included in JSON
VerificationRunSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const VerificationRun = mongoose.model<IVerificationRun, IVerificationRunModel>(
  'VerificationRun',
  VerificationRunSchema
);
