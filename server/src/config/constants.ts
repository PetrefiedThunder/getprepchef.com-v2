/**
 * Application-wide constants
 * Centralized configuration for business logic and system behavior
 */

export const APP_NAME = 'PrepChef';
export const API_VERSION = 'v1';

/**
 * User Roles (RBAC)
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  TENANT_OWNER: 'tenant_owner',
  TENANT_STAFF: 'tenant_staff',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * Vendor Status
 */
export const VENDOR_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  NEEDS_REVIEW: 'needs_review',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
} as const;

export type VendorStatus = typeof VENDOR_STATUS[keyof typeof VENDOR_STATUS];

/**
 * Verification Run Status
 */
export const VERIFICATION_RUN_STATUS = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type VerificationRunStatus = typeof VERIFICATION_RUN_STATUS[keyof typeof VERIFICATION_RUN_STATUS];

/**
 * Verification Outcome
 */
export const VERIFICATION_OUTCOME = {
  VERIFIED: 'verified',
  NEEDS_REVIEW: 'needs_review',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
} as const;

export type VerificationOutcome = typeof VERIFICATION_OUTCOME[keyof typeof VERIFICATION_OUTCOME];

/**
 * Document Types
 */
export const DOCUMENT_TYPE = {
  BUSINESS_LICENSE: 'business_license',
  HEALTH_PERMIT: 'health_permit',
  FOOD_HANDLER_CARD: 'food_handler_card',
  INSURANCE_CERTIFICATE: 'insurance_certificate',
  W9: 'w9',
  EIN_LETTER: 'ein_letter',
  LEASE_AGREEMENT: 'lease_agreement',
  OTHER: 'other',
} as const;

export type DocumentType = typeof DOCUMENT_TYPE[keyof typeof DOCUMENT_TYPE];

/**
 * Document Status
 */
export const DOCUMENT_STATUS = {
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type DocumentStatus = typeof DOCUMENT_STATUS[keyof typeof DOCUMENT_STATUS];

/**
 * Checklist Item Status
 */
export const CHECKLIST_ITEM_STATUS = {
  SATISFIED: 'satisfied',
  MISSING: 'missing',
  EXPIRED: 'expired',
  INVALID: 'invalid',
} as const;

export type ChecklistItemStatus = typeof CHECKLIST_ITEM_STATUS[keyof typeof CHECKLIST_ITEM_STATUS];

/**
 * Jurisdiction Types
 */
export const JURISDICTION_TYPE = {
  COUNTRY: 'country',
  STATE: 'state',
  COUNTY: 'county',
  CITY: 'city',
} as const;

export type JurisdictionType = typeof JURISDICTION_TYPE[keyof typeof JURISDICTION_TYPE];

/**
 * Requirement Types
 */
export const REQUIREMENT_TYPE = {
  LICENSE: 'license',
  PERMIT: 'permit',
  INSPECTION: 'inspection',
  INSURANCE: 'insurance',
  CERTIFICATION: 'certification',
  REGISTRATION: 'registration',
} as const;

export type RequirementType = typeof REQUIREMENT_TYPE[keyof typeof REQUIREMENT_TYPE];

/**
 * Requirement Frequency
 */
export const REQUIREMENT_FREQUENCY = {
  ONCE: 'once',
  ANNUAL: 'annual',
  BIENNIAL: 'biennial',
  QUARTERLY: 'quarterly',
} as const;

export type RequirementFrequency = typeof REQUIREMENT_FREQUENCY[keyof typeof REQUIREMENT_FREQUENCY];

/**
 * Priority Levels
 */
export const PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type Priority = typeof PRIORITY[keyof typeof PRIORITY];

/**
 * Webhook Event Types
 */
export const WEBHOOK_EVENT = {
  VENDOR_CREATED: 'vendor.created',
  VENDOR_UPDATED: 'vendor.updated',
  VENDOR_VERIFIED: 'vendor.verified',
  VENDOR_NEEDS_REVIEW: 'vendor.needs_review',
  VENDOR_REJECTED: 'vendor.rejected',
  VENDOR_EXPIRED: 'vendor.expired',
  VENDOR_SUSPENDED: 'vendor.suspended',
  VENDOR_DOCUMENT_UPLOADED: 'vendor.document_uploaded',
  REGULATION_UPDATED: 'regulation.updated',
  REGULATION_NEW_REQUIREMENT: 'regulation.new_requirement',
} as const;

export type WebhookEvent = typeof WEBHOOK_EVENT[keyof typeof WEBHOOK_EVENT];

/**
 * Webhook Endpoint Status
 */
export const WEBHOOK_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DISABLED: 'disabled',
} as const;

export type WebhookStatus = typeof WEBHOOK_STATUS[keyof typeof WEBHOOK_STATUS];

/**
 * Tenant Types
 */
export const TENANT_TYPE = {
  KITCHEN_OPERATOR: 'kitchen_operator',
  MARKETPLACE: 'marketplace',
  GHOST_KITCHEN: 'ghost_kitchen',
} as const;

export type TenantType = typeof TENANT_TYPE[keyof typeof TENANT_TYPE];

/**
 * Kitchen Types
 */
export const KITCHEN_TYPE = {
  SHARED: 'shared',
  GHOST: 'ghost',
  COMMISSARY: 'commissary',
} as const;

export type KitchenType = typeof KITCHEN_TYPE[keyof typeof KITCHEN_TYPE];

/**
 * Legal Entity Types
 */
export const LEGAL_ENTITY_TYPE = {
  SOLE_PROPRIETORSHIP: 'sole_proprietorship',
  LLC: 'llc',
  CORPORATION: 'corporation',
  PARTNERSHIP: 'partnership',
} as const;

export type LegalEntityType = typeof LEGAL_ENTITY_TYPE[keyof typeof LEGAL_ENTITY_TYPE];

/**
 * Verification Trigger Sources
 */
export const VERIFICATION_TRIGGER = {
  MANUAL: 'manual',
  SCHEDULED: 'scheduled',
  WEBHOOK: 'webhook',
  DOCUMENT_UPLOAD: 'document_upload',
  REGULATION_UPDATE: 'regulation_update',
} as const;

export type VerificationTrigger = typeof VERIFICATION_TRIGGER[keyof typeof VERIFICATION_TRIGGER];

/**
 * Business Logic Constants
 */
export const CONSTANTS = {
  // Document expiration warning thresholds
  DOCUMENT_EXPIRY_WARNING_DAYS: 30,
  DOCUMENT_EXPIRY_CRITICAL_DAYS: 7,

  // Verification
  VERIFICATION_TIMEOUT_MS: 30000, // 30 seconds max per verification run

  // Webhook delivery
  WEBHOOK_DELIVERY_TIMEOUT_MS: 5000,
  WEBHOOK_MAX_RETRIES: 3,
  WEBHOOK_RETRY_BACKOFF_BASE_MS: 1000, // Exponential: 1s, 2s, 4s

  // Rate limiting
  DEFAULT_RATE_LIMIT_MAX: 100,
  DEFAULT_RATE_LIMIT_WINDOW_MS: 60000, // 1 minute

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // File upload
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_FILE_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
} as const;
