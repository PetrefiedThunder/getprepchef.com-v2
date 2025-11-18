/**
 * TypeScript types for PrepChef frontend
 * Mirrors backend API models and response shapes
 */

export type UserRole = 'admin' | 'tenant_owner' | 'tenant_staff';

export type TenantType = 'kitchen_operator' | 'enterprise' | 'partner';

export type VendorStatus =
  | 'pending'
  | 'verified'
  | 'needs_review'
  | 'rejected'
  | 'expired'
  | 'suspended';

export type LegalEntityType =
  | 'sole_proprietorship'
  | 'llc'
  | 'corporation'
  | 'partnership'
  | 'nonprofit';

export type KitchenType = 'shared' | 'ghost' | 'commissary';

export type DocumentType =
  | 'business_license'
  | 'health_permit'
  | 'food_handler_card'
  | 'insurance_certificate'
  | 'tax_document'
  | 'other';

export type DocumentStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type VerificationStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface User {
  _id: string;
  tenant_id?: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: 'active' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  _id: string;
  name: string;
  type: TenantType;
  contact_email: string;
  status: 'active' | 'suspended';
  settings?: {
    auto_verify?: boolean;
    webhook_enabled?: boolean;
    notification_email?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Address {
  street: string;
  city: string;
  county?: string;
  state: string;
  zip: string;
  country: string;
}

export interface Kitchen {
  _id: string;
  tenant_id: string;
  jurisdiction_id: string;
  name: string;
  address: Address;
  type: KitchenType;
  capacity: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface VendorContact {
  email: string;
  phone: string;
  primary_contact_name: string;
}

export interface Vendor {
  _id: string;
  tenant_id: string;
  kitchen_id: string;
  business_name: string;
  dba_name?: string;
  legal_entity_type: LegalEntityType;
  business_address: Address;
  contact: VendorContact;
  status: VendorStatus;
  last_verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface VendorPerson {
  _id: string;
  vendor_id: string;
  first_name: string;
  last_name: string;
  role: 'owner' | 'manager' | 'authorized_representative';
  ownership_percentage?: number;
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface VendorDocument {
  _id: string;
  vendor_id: string;
  document_type: DocumentType;
  status: DocumentStatus;
  issue_date?: string;
  expiration_date?: string;
  document_number?: string;
  issuing_authority?: string;
  file_metadata?: {
    storage_key: string;
    filename: string;
    mimetype: string;
    size_bytes: number;
    uploaded_at: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  requirement_id: string;
  requirement_name: string;
  requirement_type: string;
  status: 'satisfied' | 'not_satisfied' | 'pending';
  notes?: string;
}

export interface Checklist {
  items: ChecklistItem[];
  total_items: number;
  satisfied_items: number;
  completion_percentage: number;
}

export interface VerificationRun {
  _id: string;
  vendor_id: string;
  status: VerificationStatus;
  outcome?: VendorStatus;
  checklist: Checklist;
  validation_errors: string[];
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Jurisdiction {
  _id: string;
  type: 'country' | 'state' | 'county' | 'city';
  name: string;
  code: string;
  parent_id?: string;
  metadata?: {
    population?: number;
    timezone?: string;
    regulatory_complexity_score?: number;
    coverage_status?: 'full' | 'partial' | 'none';
  };
  created_at: string;
  updated_at: string;
}

export interface RegRequirement {
  _id: string;
  jurisdiction_id: string;
  requirement_type: string;
  name: string;
  description?: string;
  applies_to: {
    kitchen_types: KitchenType[];
    entity_types: LegalEntityType[];
  };
  frequency?: 'once' | 'annual' | 'biannual' | 'as_needed';
  expiration_rules?: {
    has_expiration: boolean;
    validity_months?: number;
  };
  priority: number;
  version: string;
  effective_from: string;
  effective_to?: string;
  created_at: string;
  updated_at: string;
}

export interface HealthDept {
  _id: string;
  jurisdiction_id: string;
  name: string;
  website_url?: string;
  phone?: string;
  email?: string;
  address?: Address;
  created_at: string;
  updated_at: string;
}

export interface WebhookEndpoint {
  _id: string;
  tenant_id: string;
  url: string;
  events: string[];
  status: 'active' | 'paused' | 'disabled';
  failure_count: number;
  last_delivery_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  _id: string;
  endpoint_id: string;
  event: string;
  status: 'pending' | 'delivered' | 'failed';
  http_status?: number;
  response_body?: string;
  attempt: number;
  created_at: string;
  delivered_at?: string;
}

// API Response types
export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface LoginResponse {
  user: User;
  access_token: string;
  refresh_token: string;
}

export interface RegisterResponse {
  user: User;
  tenant: Tenant;
  access_token: string;
  refresh_token: string;
  api_key: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface VerificationStats {
  total_vendors: number;
  verified: number;
  pending: number;
  needs_review: number;
  expired: number;
  rejected: number;
  suspended: number;
}

export interface CoverageStats {
  total_jurisdictions: number;
  full_coverage: number;
  partial_coverage: number;
  no_coverage: number;
  total_requirements: number;
}

export interface ChecklistQuery {
  jurisdiction_id?: string;
  state?: string;
  county?: string;
  kitchen_type: KitchenType;
  entity_type: LegalEntityType;
}

export interface ChecklistResponse {
  jurisdiction: Jurisdiction;
  hierarchy: Jurisdiction[];
  requirements: RegRequirement[];
  health_dept?: HealthDept;
}
