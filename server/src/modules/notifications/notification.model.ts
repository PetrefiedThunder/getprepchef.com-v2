import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Notification Model
 * In-app notifications for operators
 */

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  tenant_id: mongoose.Types.ObjectId;
  user_id?: mongoose.Types.ObjectId; // Specific user, or null for all tenant users
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  link?: string; // Deep link to relevant page
  read: boolean;
  read_at?: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;

  // Methods
  markRead(): Promise<void>;
}

export interface INotificationModel extends Model<INotification> {
  findByTenant(tenantId: mongoose.Types.ObjectId, limit?: number): Promise<INotification[]>;
  findByUser(userId: mongoose.Types.ObjectId, limit?: number): Promise<INotification[]>;
  findUnreadByUser(userId: mongoose.Types.ObjectId): Promise<INotification[]>;
  createNotification(
    tenantId: mongoose.Types.ObjectId,
    type: string,
    title: string,
    message: string,
    userId?: mongoose.Types.ObjectId
  ): Promise<INotification>;
}

const NotificationSchema = new Schema<INotification, INotificationModel>(
  {
    tenant_id: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['info', 'warning', 'error', 'success'],
      default: 'info',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      default: null,
    },
    read: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    read_at: {
      type: Date,
      default: null,
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
NotificationSchema.index({ tenant_id: 1, created_at: -1 });
NotificationSchema.index({ user_id: 1, read: 1, created_at: -1 });

// Instance method: Mark as read
NotificationSchema.methods.markRead = async function (
  this: INotification
): Promise<void> {
  this.read = true;
  this.read_at = new Date();
  await this.save();
};

// Static method: Find notifications for a tenant
NotificationSchema.statics.findByTenant = async function (
  this: INotificationModel,
  tenantId: mongoose.Types.ObjectId,
  limit: number = 50
): Promise<INotification[]> {
  return this.find({ tenant_id: tenantId }).sort({ created_at: -1 }).limit(limit);
};

// Static method: Find notifications for a user
NotificationSchema.statics.findByUser = async function (
  this: INotificationModel,
  userId: mongoose.Types.ObjectId,
  limit: number = 50
): Promise<INotification[]> {
  return this.find({
    $or: [{ user_id: userId }, { user_id: null }],
  })
    .sort({ created_at: -1 })
    .limit(limit);
};

// Static method: Find unread notifications for a user
NotificationSchema.statics.findUnreadByUser = async function (
  this: INotificationModel,
  userId: mongoose.Types.ObjectId
): Promise<INotification[]> {
  return this.find({
    $or: [{ user_id: userId }, { user_id: null }],
    read: false,
  }).sort({ created_at: -1 });
};

// Static method: Create notification
NotificationSchema.statics.createNotification = async function (
  this: INotificationModel,
  tenantId: mongoose.Types.ObjectId,
  type: string,
  title: string,
  message: string,
  userId?: mongoose.Types.ObjectId
): Promise<INotification> {
  return this.create({
    tenant_id: tenantId,
    user_id: userId || null,
    type,
    title,
    message,
  });
};

// Ensure virtuals are included in JSON
NotificationSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Notification = mongoose.model<INotification, INotificationModel>(
  'Notification',
  NotificationSchema
);
