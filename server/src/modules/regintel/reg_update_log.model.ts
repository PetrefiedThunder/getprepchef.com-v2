import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * RegUpdateLog Model
 * Tracks regulatory changes and updates
 */

export interface IImpactAssessment {
  affected_vendor_count: number;
  requires_reverification: boolean;
  urgency: 'immediate' | 'high' | 'medium' | 'low';
}

export interface IRegUpdateLog extends Document {
  _id: mongoose.Types.ObjectId;
  jurisdiction_id: mongoose.Types.ObjectId;
  update_type: 'new_requirement' | 'requirement_modified' | 'requirement_removed' | 'contact_updated';
  affected_requirement_ids: mongoose.Types.ObjectId[];
  diff_summary: string; // Human-readable summary of changes
  source: 'manual' | 'automated_scraper' | 'official_api';
  detected_at: Date;
  processed_at?: Date;
  impact_assessment: IImpactAssessment;
  created_at: Date;
  updated_at: Date;

  // Methods
  markProcessed(): Promise<void>;
}

export interface IRegUpdateLogModel extends Model<IRegUpdateLog> {
  findUnprocessed(): Promise<IRegUpdateLog[]>;
  findByJurisdiction(jurisdictionId: mongoose.Types.ObjectId): Promise<IRegUpdateLog[]>;
  findCriticalUpdates(): Promise<IRegUpdateLog[]>;
}

const ImpactAssessmentSchema = new Schema<IImpactAssessment>(
  {
    affected_vendor_count: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    requires_reverification: {
      type: Boolean,
      required: true,
      default: false,
    },
    urgency: {
      type: String,
      required: true,
      enum: ['immediate', 'high', 'medium', 'low'],
      default: 'medium',
    },
  },
  { _id: false }
);

const RegUpdateLogSchema = new Schema<IRegUpdateLog, IRegUpdateLogModel>(
  {
    jurisdiction_id: {
      type: Schema.Types.ObjectId,
      ref: 'Jurisdiction',
      required: true,
      index: true,
    },
    update_type: {
      type: String,
      required: true,
      enum: ['new_requirement', 'requirement_modified', 'requirement_removed', 'contact_updated'],
      index: true,
    },
    affected_requirement_ids: {
      type: [Schema.Types.ObjectId],
      ref: 'RegRequirement',
      default: [],
    },
    diff_summary: {
      type: String,
      required: true,
    },
    source: {
      type: String,
      required: true,
      enum: ['manual', 'automated_scraper', 'official_api'],
      default: 'manual',
    },
    detected_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
    processed_at: {
      type: Date,
      default: null,
      index: true,
    },
    impact_assessment: {
      type: ImpactAssessmentSchema,
      required: true,
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
RegUpdateLogSchema.index({ jurisdiction_id: 1, detected_at: -1 });
RegUpdateLogSchema.index({ processed_at: 1 });
RegUpdateLogSchema.index({ 'impact_assessment.urgency': 1, processed_at: 1 });

// Instance method: Mark update as processed
RegUpdateLogSchema.methods.markProcessed = async function (
  this: IRegUpdateLog
): Promise<void> {
  this.processed_at = new Date();
  await this.save();
};

// Static method: Find unprocessed updates
RegUpdateLogSchema.statics.findUnprocessed = async function (
  this: IRegUpdateLogModel
): Promise<IRegUpdateLog[]> {
  return this.find({ processed_at: null }).sort({ detected_at: 1 });
};

// Static method: Find updates for a jurisdiction
RegUpdateLogSchema.statics.findByJurisdiction = async function (
  this: IRegUpdateLogModel,
  jurisdictionId: mongoose.Types.ObjectId
): Promise<IRegUpdateLog[]> {
  return this.find({ jurisdiction_id: jurisdictionId }).sort({ detected_at: -1 }).limit(100);
};

// Static method: Find critical updates (immediate/high urgency)
RegUpdateLogSchema.statics.findCriticalUpdates = async function (
  this: IRegUpdateLogModel
): Promise<IRegUpdateLog[]> {
  return this.find({
    'impact_assessment.urgency': { $in: ['immediate', 'high'] },
    processed_at: null,
  }).sort({ detected_at: 1 });
};

// Ensure virtuals are included in JSON
RegUpdateLogSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const RegUpdateLog = mongoose.model<IRegUpdateLog, IRegUpdateLogModel>(
  'RegUpdateLog',
  RegUpdateLogSchema
);
