import mongoose, { Schema, Document, Model } from 'mongoose';
import { JURISDICTION_TYPE, JurisdictionType } from '@/config/constants';

/**
 * Jurisdiction Model
 * Represents a geographic regulatory jurisdiction (country/state/county/city)
 */

export interface IJurisdiction extends Document {
  _id: mongoose.Types.ObjectId;
  type: JurisdictionType;
  name: string;
  code: string; // e.g., "US-CA-LAC" for LA County
  parent_id?: mongoose.Types.ObjectId; // Hierarchical relationship
  geometry?: any; // GeoJSON for mapping (future)
  metadata?: {
    population?: number;
    timezone?: string;
    regulatory_complexity_score?: number; // 1-10
    coverage_status?: 'full' | 'partial' | 'none';
  };
  created_at: Date;
  updated_at: Date;

  // Virtual properties
  full_path: string; // e.g., "United States > California > Los Angeles County"
}

export interface IJurisdictionModel extends Model<IJurisdiction> {
  findByCode(code: string): Promise<IJurisdiction | null>;
  findByState(stateCode: string): Promise<IJurisdiction[]>;
  buildHierarchy(jurisdictionId: mongoose.Types.ObjectId): Promise<IJurisdiction[]>;
}

const JurisdictionSchema = new Schema<IJurisdiction, IJurisdictionModel>(
  {
    type: {
      type: String,
      required: true,
      enum: Object.values(JURISDICTION_TYPE),
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    parent_id: {
      type: Schema.Types.ObjectId,
      ref: 'Jurisdiction',
      default: null,
      index: true,
    },
    geometry: {
      type: Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      population: {
        type: Number,
        min: 0,
        default: null,
      },
      timezone: {
        type: String,
        default: 'America/Los_Angeles',
      },
      regulatory_complexity_score: {
        type: Number,
        min: 1,
        max: 10,
        default: 5,
      },
      coverage_status: {
        type: String,
        enum: ['full', 'partial', 'none'],
        default: 'none',
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
JurisdictionSchema.index({ code: 1 }, { unique: true });
JurisdictionSchema.index({ type: 1, parent_id: 1 });
JurisdictionSchema.index({ name: 'text' }); // Text search

// Static method: Find by code
JurisdictionSchema.statics.findByCode = async function (
  this: IJurisdictionModel,
  code: string
): Promise<IJurisdiction | null> {
  return this.findOne({ code: code.toUpperCase() });
};

// Static method: Find all jurisdictions in a state
JurisdictionSchema.statics.findByState = async function (
  this: IJurisdictionModel,
  stateCode: string
): Promise<IJurisdiction[]> {
  // First find the state jurisdiction - sanitize stateCode to prevent ReDoS
  const sanitizedStateCode = stateCode.toUpperCase().replace(/[^A-Z]/g, '');
  const state = await this.findOne({
    type: JURISDICTION_TYPE.STATE,
    code: `US-${sanitizedStateCode}`,
  });

  if (!state) {
    return [];
  }

  // Find all child jurisdictions
  return this.find({ parent_id: state._id }).sort({ name: 1 });
};

// Static method: Build full jurisdiction hierarchy
JurisdictionSchema.statics.buildHierarchy = async function (
  this: IJurisdictionModel,
  jurisdictionId: mongoose.Types.ObjectId
): Promise<IJurisdiction[]> {
  const hierarchy: IJurisdiction[] = [];
  let current = await this.findById(jurisdictionId);

  while (current) {
    hierarchy.unshift(current); // Add to beginning
    if (current.parent_id) {
      current = await this.findById(current.parent_id);
    } else {
      current = null;
    }
  }

  return hierarchy;
};

// Ensure virtuals are included in JSON
JurisdictionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Jurisdiction = mongoose.model<IJurisdiction, IJurisdictionModel>(
  'Jurisdiction',
  JurisdictionSchema
);
