import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  REQUIREMENT_TYPE,
  RequirementType,
  REQUIREMENT_FREQUENCY,
  RequirementFrequency,
  PRIORITY,
  Priority,
  KITCHEN_TYPE,
  LEGAL_ENTITY_TYPE,
} from '@/config/constants';

/**
 * RegRequirement Model
 * Defines regulatory requirements for a jurisdiction
 */

export interface IApplicabilityRules {
  kitchen_types?: string[]; // Which kitchen types this applies to
  vendor_types?: string[]; // Which vendor types this applies to
  business_entity_types?: string[]; // Which legal entities this applies to
}

export interface IExpirationRules {
  has_expiration: boolean;
  validity_period_days?: number; // How long the document is valid
  renewal_window_days?: number; // When renewal can begin
}

export interface IRegRequirement extends Document {
  _id: mongoose.Types.ObjectId;
  jurisdiction_id: mongoose.Types.ObjectId;
  requirement_type: RequirementType;
  name: string;
  description: string;
  applies_to: IApplicabilityRules;
  frequency: RequirementFrequency;
  expiration_rules: IExpirationRules;
  verification_method: 'document_upload' | 'api_check' | 'manual_review';
  priority: Priority;
  version: string; // Semantic versioning
  effective_from: Date;
  effective_to?: Date; // Null if currently active
  source_url?: string; // Link to official regulation
  created_at: Date;
  updated_at: Date;

  // Methods
  isActive(): boolean;
  appliesToKitchen(kitchenType: string): boolean;
  appliesToEntityType(entityType: string): boolean;
}

export interface IRegRequirementModel extends Model<IRegRequirement> {
  findByJurisdiction(jurisdictionId: mongoose.Types.ObjectId): Promise<IRegRequirement[]>;
  findActiveByJurisdiction(jurisdictionId: mongoose.Types.ObjectId): Promise<IRegRequirement[]>;
  findApplicable(
    jurisdictionId: mongoose.Types.ObjectId,
    kitchenType: string,
    entityType: string
  ): Promise<IRegRequirement[]>;
}

const ApplicabilityRulesSchema = new Schema<IApplicabilityRules>(
  {
    kitchen_types: {
      type: [String],
      default: Object.values(KITCHEN_TYPE), // Default: applies to all
      enum: Object.values(KITCHEN_TYPE),
    },
    vendor_types: {
      type: [String],
      default: [],
    },
    business_entity_types: {
      type: [String],
      default: Object.values(LEGAL_ENTITY_TYPE), // Default: applies to all
      enum: Object.values(LEGAL_ENTITY_TYPE),
    },
  },
  { _id: false }
);

const ExpirationRulesSchema = new Schema<IExpirationRules>(
  {
    has_expiration: {
      type: Boolean,
      required: true,
      default: true,
    },
    validity_period_days: {
      type: Number,
      min: 1,
      default: 365, // 1 year default
    },
    renewal_window_days: {
      type: Number,
      min: 1,
      default: 30, // Can renew 30 days before expiry
    },
  },
  { _id: false }
);

const RegRequirementSchema = new Schema<IRegRequirement, IRegRequirementModel>(
  {
    jurisdiction_id: {
      type: Schema.Types.ObjectId,
      ref: 'Jurisdiction',
      required: true,
      index: true,
    },
    requirement_type: {
      type: String,
      required: true,
      enum: Object.values(REQUIREMENT_TYPE),
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    applies_to: {
      type: ApplicabilityRulesSchema,
      required: true,
      default: () => ({}),
    },
    frequency: {
      type: String,
      required: true,
      enum: Object.values(REQUIREMENT_FREQUENCY),
      default: REQUIREMENT_FREQUENCY.ANNUAL,
    },
    expiration_rules: {
      type: ExpirationRulesSchema,
      required: true,
      default: () => ({
        has_expiration: true,
        validity_period_days: 365,
        renewal_window_days: 30,
      }),
    },
    verification_method: {
      type: String,
      required: true,
      enum: ['document_upload', 'api_check', 'manual_review'],
      default: 'document_upload',
    },
    priority: {
      type: String,
      required: true,
      enum: Object.values(PRIORITY),
      default: PRIORITY.MEDIUM,
    },
    version: {
      type: String,
      required: true,
      default: '1.0.0',
      validate: {
        validator: (v: string) => /^\d+\.\d+\.\d+$/.test(v),
        message: 'Version must be in semantic versioning format (e.g., 1.0.0)',
      },
    },
    effective_from: {
      type: Date,
      required: true,
      default: Date.now,
    },
    effective_to: {
      type: Date,
      default: null,
    },
    source_url: {
      type: String,
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
RegRequirementSchema.index({ jurisdiction_id: 1, effective_to: 1 });
RegRequirementSchema.index({ requirement_type: 1, priority: 1 });
RegRequirementSchema.index({ effective_from: 1, effective_to: 1 });

// Instance method: Check if requirement is currently active
RegRequirementSchema.methods.isActive = function (this: IRegRequirement): boolean {
  const now = new Date();
  const isEffective = this.effective_from <= now;
  const notExpired = !this.effective_to || this.effective_to > now;
  return isEffective && notExpired;
};

// Instance method: Check if applies to kitchen type
RegRequirementSchema.methods.appliesToKitchen = function (
  this: IRegRequirement,
  kitchenType: string
): boolean {
  if (!this.applies_to.kitchen_types || this.applies_to.kitchen_types.length === 0) {
    return true; // Applies to all if not specified
  }
  return this.applies_to.kitchen_types.includes(kitchenType);
};

// Instance method: Check if applies to entity type
RegRequirementSchema.methods.appliesToEntityType = function (
  this: IRegRequirement,
  entityType: string
): boolean {
  if (
    !this.applies_to.business_entity_types ||
    this.applies_to.business_entity_types.length === 0
  ) {
    return true; // Applies to all if not specified
  }
  return this.applies_to.business_entity_types.includes(entityType);
};

// Static method: Find all requirements for a jurisdiction
RegRequirementSchema.statics.findByJurisdiction = async function (
  this: IRegRequirementModel,
  jurisdictionId: mongoose.Types.ObjectId
): Promise<IRegRequirement[]> {
  return this.find({ jurisdiction_id: jurisdictionId }).sort({
    priority: 1,
    requirement_type: 1,
  });
};

// Static method: Find active requirements for a jurisdiction
RegRequirementSchema.statics.findActiveByJurisdiction = async function (
  this: IRegRequirementModel,
  jurisdictionId: mongoose.Types.ObjectId
): Promise<IRegRequirement[]> {
  const now = new Date();
  return this.find({
    jurisdiction_id: jurisdictionId,
    effective_from: { $lte: now },
    $or: [{ effective_to: null }, { effective_to: { $gt: now } }],
  }).sort({ priority: 1, requirement_type: 1 });
};

// Static method: Find applicable requirements
RegRequirementSchema.statics.findApplicable = async function (
  this: IRegRequirementModel,
  jurisdictionId: mongoose.Types.ObjectId,
  kitchenType: string,
  entityType: string
): Promise<IRegRequirement[]> {
  const now = new Date();

  // Get all active requirements for jurisdiction
  const allRequirements = await this.find({
    jurisdiction_id: jurisdictionId,
    effective_from: { $lte: now },
    $or: [{ effective_to: null }, { effective_to: { $gt: now } }],
  });

  // Filter by applicability rules
  const applicableRequirements = allRequirements.filter((req) => {
    const appliesToKitchen = req.appliesToKitchen(kitchenType);
    const appliesToEntity = req.appliesToEntityType(entityType);
    return appliesToKitchen && appliesToEntity;
  });

  return applicableRequirements.sort((a, b) => {
    // Sort by priority (critical first), then by type
    const priorityOrder: Record<Priority, number> = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
    };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
};

// Ensure virtuals are included in JSON
RegRequirementSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const RegRequirement = mongoose.model<IRegRequirement, IRegRequirementModel>(
  'RegRequirement',
  RegRequirementSchema
);
