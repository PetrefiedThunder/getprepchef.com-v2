import mongoose from 'mongoose';
import {
  VERIFICATION_OUTCOME,
  CHECKLIST_ITEM_STATUS,
  DOCUMENT_STATUS,
  DOCUMENT_TYPE,
  CONSTANTS,
} from '@/config/constants';
import { IVendor } from '@/modules/vendors/vendor.model';
import { IVendorDocument } from '@/modules/documents/document.model';
import { IChecklistItem, IVerificationChecklist } from './verification_run.model';
import logger from '@/lib/logger';

/**
 * Verification Rules Engine
 * Contains business logic for vendor verification
 */

export interface IRegRequirement {
  _id: mongoose.Types.ObjectId;
  requirement_type: string;
  name: string;
  description: string;
  priority: string;
  expiration_rules?: {
    has_expiration: boolean;
    validity_period_days?: number;
  };
}

export interface IVerificationResult {
  outcome: typeof VERIFICATION_OUTCOME[keyof typeof VERIFICATION_OUTCOME];
  outcome_reason: string;
  checklist: IVerificationChecklist;
}

/**
 * Main verification function
 * Evaluates a vendor against regulatory requirements
 */
export async function verifyVendor(
  vendor: IVendor,
  vendorDocuments: IVendorDocument[],
  requirements: IRegRequirement[]
): Promise<IVerificationResult> {
  logger.info({
    msg: 'Starting vendor verification',
    vendor_id: vendor._id.toString(),
    document_count: vendorDocuments.length,
    requirement_count: requirements.length,
  });

  // Build checklist from requirements
  const checklistItems: IChecklistItem[] = [];

  for (const requirement of requirements) {
    const item = evaluateRequirement(requirement, vendor, vendorDocuments);
    checklistItems.push(item);
  }

  // Calculate checklist stats
  const totalItems = checklistItems.length;
  const satisfiedItems = checklistItems.filter(
    (item) => item.status === CHECKLIST_ITEM_STATUS.SATISFIED
  ).length;
  const completionPercentage = totalItems > 0
    ? Math.round((satisfiedItems / totalItems) * 100)
    : 0;

  const checklist: IVerificationChecklist = {
    items: checklistItems,
    total_items: totalItems,
    satisfied_items: satisfiedItems,
    completion_percentage: completionPercentage,
  };

  // Determine outcome
  const { outcome, outcome_reason } = determineOutcome(checklist);

  logger.info({
    msg: 'Vendor verification complete',
    vendor_id: vendor._id.toString(),
    outcome,
    completion_percentage: completionPercentage,
  });

  return {
    outcome,
    outcome_reason,
    checklist,
  };
}

/**
 * Evaluate a single requirement against vendor documents
 */
function evaluateRequirement(
  requirement: IRegRequirement,
  vendor: IVendor,
  vendorDocuments: IVendorDocument[]
): IChecklistItem {
  const item: IChecklistItem = {
    requirement_id: requirement._id,
    requirement_name: requirement.name,
    requirement_type: requirement.requirement_type,
    status: CHECKLIST_ITEM_STATUS.MISSING,
    notes: '',
  };

  // Map requirement type to document type
  const documentType = mapRequirementToDocumentType(requirement.requirement_type);

  if (!documentType) {
    item.status = CHECKLIST_ITEM_STATUS.SATISFIED;
    item.notes = 'No document required for this requirement type';
    return item;
  }

  // Find matching documents
  const matchingDocs = vendorDocuments.filter(
    (doc) => doc.document_type === documentType && doc.status === DOCUMENT_STATUS.APPROVED
  );

  if (matchingDocs.length === 0) {
    item.status = CHECKLIST_ITEM_STATUS.MISSING;
    item.notes = `No approved ${documentType} document found`;
    return item;
  }

  // Get the most recent approved document
  const latestDoc = matchingDocs.sort(
    (a, b) => b.created_at.getTime() - a.created_at.getTime()
  )[0];

  if (!latestDoc) {
    item.status = CHECKLIST_ITEM_STATUS.MISSING;
    return item;
  }

  item.associated_document_id = latestDoc._id;

  // Check expiration if requirement has expiration rules
  if (requirement.expiration_rules?.has_expiration && latestDoc.expiration_date) {
    if (latestDoc.isExpired()) {
      item.status = CHECKLIST_ITEM_STATUS.EXPIRED;
      item.notes = `Document expired on ${latestDoc.expiration_date.toISOString().split('T')[0]}`;
      return item;
    }

    // Check if expiring soon (warning)
    if (latestDoc.isExpiring(CONSTANTS.DOCUMENT_EXPIRY_WARNING_DAYS)) {
      item.status = CHECKLIST_ITEM_STATUS.SATISFIED;
      item.notes = `Document expires soon on ${latestDoc.expiration_date.toISOString().split('T')[0]}`;
      return item;
    }
  }

  // Additional validation checks
  const validationResult = validateDocument(latestDoc, requirement);
  if (!validationResult.valid) {
    item.status = CHECKLIST_ITEM_STATUS.INVALID;
    item.notes = validationResult.reason || 'Document validation failed';
    return item;
  }

  // All checks passed
  item.status = CHECKLIST_ITEM_STATUS.SATISFIED;
  item.notes = 'Document approved and valid';

  return item;
}

/**
 * Map requirement type to document type
 */
function mapRequirementToDocumentType(
  requirementType: string
): typeof DOCUMENT_TYPE[keyof typeof DOCUMENT_TYPE] | null {
  const mapping: Record<string, typeof DOCUMENT_TYPE[keyof typeof DOCUMENT_TYPE]> = {
    license: DOCUMENT_TYPE.BUSINESS_LICENSE,
    permit: DOCUMENT_TYPE.HEALTH_PERMIT,
    insurance: DOCUMENT_TYPE.INSURANCE_CERTIFICATE,
    certification: DOCUMENT_TYPE.FOOD_HANDLER_CARD,
  };

  return mapping[requirementType] || null;
}

/**
 * Validate a document against a requirement
 */
function validateDocument(
  document: IVendorDocument,
  requirement: IRegRequirement
): { valid: boolean; reason?: string } {
  // Check if document has required metadata
  if (!document.file_metadata || !document.file_metadata.storage_key) {
    return { valid: false, reason: 'Document file missing' };
  }

  // Check file size (basic validation)
  if (document.file_metadata.size_bytes === 0) {
    return { valid: false, reason: 'Document file is empty' };
  }

  // For insurance certificates, check if recently issued
  if (document.document_type === DOCUMENT_TYPE.INSURANCE_CERTIFICATE) {
    if (document.issue_date) {
      const daysSinceIssue = Math.floor(
        (Date.now() - document.issue_date.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Insurance should be issued within last year
      if (daysSinceIssue > 365) {
        return {
          valid: false,
          reason: 'Insurance certificate is too old (>1 year since issue)',
        };
      }
    }
  }

  // All validations passed
  return { valid: true };
}

/**
 * Determine overall verification outcome from checklist
 */
function determineOutcome(checklist: IVerificationChecklist): {
  outcome: typeof VERIFICATION_OUTCOME[keyof typeof VERIFICATION_OUTCOME];
  outcome_reason: string;
} {
  const { items, completion_percentage } = checklist;

  // Count items by status
  const statusCounts = {
    satisfied: 0,
    missing: 0,
    expired: 0,
    invalid: 0,
  };

  for (const item of items) {
    if (item.status === CHECKLIST_ITEM_STATUS.SATISFIED) {
      statusCounts.satisfied++;
    } else if (item.status === CHECKLIST_ITEM_STATUS.MISSING) {
      statusCounts.missing++;
    } else if (item.status === CHECKLIST_ITEM_STATUS.EXPIRED) {
      statusCounts.expired++;
    } else if (item.status === CHECKLIST_ITEM_STATUS.INVALID) {
      statusCounts.invalid++;
    }
  }

  // No requirements = auto-verify (edge case)
  if (items.length === 0) {
    return {
      outcome: VERIFICATION_OUTCOME.VERIFIED,
      outcome_reason: 'No regulatory requirements for this jurisdiction',
    };
  }

  // Any expired documents = expired status
  if (statusCounts.expired > 0) {
    return {
      outcome: VERIFICATION_OUTCOME.EXPIRED,
      outcome_reason: `${statusCounts.expired} document(s) expired`,
    };
  }

  // Any invalid documents = needs review
  if (statusCounts.invalid > 0) {
    return {
      outcome: VERIFICATION_OUTCOME.NEEDS_REVIEW,
      outcome_reason: `${statusCounts.invalid} document(s) failed validation`,
    };
  }

  // 100% complete = verified
  if (completion_percentage === 100) {
    return {
      outcome: VERIFICATION_OUTCOME.VERIFIED,
      outcome_reason: 'All requirements satisfied',
    };
  }

  // 80-99% complete = needs review (almost there)
  if (completion_percentage >= 80) {
    return {
      outcome: VERIFICATION_OUTCOME.NEEDS_REVIEW,
      outcome_reason: `${statusCounts.missing} document(s) missing (${completion_percentage}% complete)`,
    };
  }

  // <80% complete = rejected
  return {
    outcome: VERIFICATION_OUTCOME.REJECTED,
    outcome_reason: `Incomplete submission: ${statusCounts.missing} document(s) missing (${completion_percentage}% complete)`,
  };
}

/**
 * Check if vendor needs re-verification
 * Based on time since last verification and document changes
 */
export function needsReverification(
  vendor: IVendor,
  daysSinceLastVerification: number,
  maxDaysBetweenVerifications: number = 90
): boolean {
  // Never verified = needs verification
  if (!vendor.last_verified_at) {
    return true;
  }

  // Exceeded max days = needs verification
  if (daysSinceLastVerification > maxDaysBetweenVerifications) {
    return true;
  }

  // Status is not verified = needs verification
  if (vendor.status !== 'verified') {
    return true;
  }

  return false;
}
