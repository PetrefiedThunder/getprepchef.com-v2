import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { USER_ROLES, UserRole } from '@/config/constants';
import { config } from '@/config/env';

/**
 * User Model
 * Represents operator staff (admin, tenant_owner, tenant_staff)
 */

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  tenant_id?: mongoose.Types.ObjectId; // Null for admins
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  permissions?: string[];
  last_login_at?: Date;
  refresh_token_version: number; // For token invalidation
  status: 'active' | 'suspended';
  created_at: Date;
  updated_at: Date;

  // Virtual properties
  full_name: string;

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  incrementRefreshTokenVersion(): Promise<void>;
}

export interface IUserModel extends Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
  hashPassword(password: string): Promise<string>;
}

const UserSchema = new Schema<IUser, IUserModel>(
  {
    tenant_id: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      validate: {
        validator: (v: string) => /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v),
        message: 'Invalid email format',
      },
    },
    password_hash: {
      type: String,
      required: true,
      select: false, // Don't return password hash by default
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
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.TENANT_STAFF,
    },
    permissions: {
      type: [String],
      default: [],
    },
    last_login_at: {
      type: Date,
      default: null,
    },
    refresh_token_version: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
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
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ tenant_id: 1, status: 1 });

// Virtual: full_name
UserSchema.virtual('full_name').get(function (this: IUser) {
  return `${this.first_name} ${this.last_name}`;
});

// Instance method: Compare password
UserSchema.methods.comparePassword = async function (
  this: IUser,
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password_hash);
};

// Instance method: Increment refresh token version (invalidates all tokens)
UserSchema.methods.incrementRefreshTokenVersion = async function (
  this: IUser
): Promise<void> {
  this.refresh_token_version += 1;
  await this.save();
};

// Static method: Find by email
UserSchema.statics.findByEmail = async function (
  this: IUserModel,
  email: string
): Promise<IUser | null> {
  return this.findOne({ email: email.toLowerCase() }).select('+password_hash');
};

// Static method: Hash password
UserSchema.statics.hashPassword = async function (
  this: IUserModel,
  password: string
): Promise<string> {
  return bcrypt.hash(password, config.BCRYPT_ROUNDS);
};

// Pre-save hook: Hash password if modified
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password_hash')) {
    return next();
  }

  // Password is already hashed if it starts with $2b$ (bcrypt signature)
  if (this.password_hash.startsWith('$2b$')) {
    return next();
  }

  // Hash the password
  this.password_hash = await bcrypt.hash(this.password_hash, config.BCRYPT_ROUNDS);
  next();
});

// Ensure virtuals are included in JSON
UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.password_hash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model<IUser, IUserModel>('User', UserSchema);
