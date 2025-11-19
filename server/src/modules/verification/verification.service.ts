import mongoose from 'mongoose';
import { Vendor, IVendor } from '@/modules/vendors/vendor.model';
import { VendorDocument } from '@/modules/documents/document.model';
import { Kitchen } from '@/modules/kitchens/kitchen.model';
import { RegRequirement } from '@/modules/regintel/reg_requirement.model';
import { VerificationRun, IVerificationRun } from './verification_run.model';
import { verifyVendor, IVerificationResult } from './verification.rules';
import { VERIFICATION_TRIGGER, VerificationTrigger, VENDOR_STATUS } from '@/config/constants';
import { NotFoundError } from '@/middleware/error_handler';
import logger from '@/lib/logger';

/**
 * Verification Service
 * Orchestrates vendor verification process
 */

export class VerificationService {
  /**
   * Trigger verification run for a vendor
   */
  static async triggerVerification(
    vendorId: string,
    tenantId: mongoose.Types.ObjectId,
    triggeredBy: VerificationTrigger = VERIFICATION_TRIGGER.MANUAL,
    userId?: mongoose.Types.ObjectId
  ): Promise<IVerificationRun> {
    logger.info({
      msg: 'Triggering verification',
      vendor_id: vendorId,
      tenant_id: tenantId.toString(),
      triggered_by: triggeredBy,
    });

    // Get vendor
    const vendor = await Vendor.findOne({
      _id: new mongoose.Types.ObjectId(vendorId),
      tenant_id: tenantId,
    });

    if (!vendor) {
      throw new NotFoundError('Vendor');
    }

    // Create verification run
    const verificationRun = await VerificationRun.create({
      vendor_id: vendor._id,
      tenant_id: tenantId,
      triggered_by: triggeredBy,
      triggered_by_user_id: userId || null,
      status: 'running',
      checklist: {
        items: [],
        total_items: 0,
        satisfied_items: 0,
        completion_percentage: 0,
      },
      validation_errors: [],
      started_at: new Date(),
    });

    // Execute verification asynchronously (in real implementation, this would be a job)
    // For now, we'll do it synchronously
    await this.executeVerification(verificationRun._id);

    return verificationRun;
  }

  /**
   * Execute verification logic
   */
  static async executeVerification(
    verificationRunId: mongoose.Types.ObjectId
  ): Promise<IVerificationRun> {
    const run = await VerificationRun.findById(verificationRunId);
    if (!run) {
      throw new NotFoundError('VerificationRun');
    }

    try {
      logger.info({
        msg: 'Executing verification',
        verification_run_id: run._id.toString(),
        vendor_id: run.vendor_id.toString(),
      });

      // Get vendor with kitchen
      const vendor = await Vendor.findById(run.vendor_id).populate('kitchen_id');
      if (!vendor) {
        throw new NotFoundError('Vendor');
      }

      // Validate kitchen is populated and not just an ObjectId
      if (!vendor.kitchen_id || typeof vendor.kitchen_id === 'string') {
        throw new Error('Kitchen not populated - database integrity issue');
      }

      const kitchen = vendor.kitchen_id as any;

      // Get vendor documents
      const vendorDocuments = await VendorDocument.findByVendor(vendor._id);

      // Get regulatory requirements
      let requirements: any[] = [];
      if (kitchen.jurisdiction_id) {
        requirements = await RegRequirement.findApplicable(
          kitchen.jurisdiction_id,
          kitchen.type,
          vendor.legal_entity_type
        );
      }

      logger.info({
        msg: 'Loaded verification data',
        vendor_id: vendor._id.toString(),
        document_count: vendorDocuments.length,
        requirement_count: requirements.length,
      });

      // Run verification rules
      const result: IVerificationResult = await verifyVendor(
        vendor,
        vendorDocuments,
        requirements
      );

      // Update verification run
      run.checklist = result.checklist;
      await run.complete(result.outcome, result.outcome_reason);

      // Update vendor status
      await vendor.updateStatus(result.outcome as any);
      vendor.current_verification_run_id = run._id;
      await vendor.save();

      logger.info({
        msg: 'Verification complete',
        verification_run_id: run._id.toString(),
        vendor_id: vendor._id.toString(),
        outcome: result.outcome,
      });

      return run;
    } catch (error) {
      logger.error({
        msg: 'Verification failed',
        verification_run_id: run._id.toString(),
        error: error instanceof Error ? error.message : String(error),
      });

      await run.fail(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get verification history for a vendor
   */
  static async getVerificationHistory(
    vendorId: string,
    tenantId: mongoose.Types.ObjectId
  ): Promise<IVerificationRun[]> {
    // Verify vendor belongs to tenant
    const vendor = await Vendor.findOne({
      _id: new mongoose.Types.ObjectId(vendorId),
      tenant_id: tenantId,
    });

    if (!vendor) {
      throw new NotFoundError('Vendor');
    }

    return VerificationRun.findByVendor(vendor._id);
  }

  /**
   * Get verification run details
   */
  static async getVerificationRun(
    runId: string,
    tenantId: mongoose.Types.ObjectId
  ): Promise<IVerificationRun> {
    const run = await VerificationRun.findById(runId).populate('vendor_id');

    if (!run) {
      throw new NotFoundError('VerificationRun');
    }

    // Verify tenant access
    if (run.tenant_id.toString() !== tenantId.toString()) {
      throw new NotFoundError('VerificationRun');
    }

    return run;
  }

  /**
   * Re-verify all vendors in a jurisdiction (after regulatory update)
   */
  static async reverifyJurisdiction(
    jurisdictionId: mongoose.Types.ObjectId
  ): Promise<{ queued: number }> {
    logger.info({
      msg: 'Re-verifying jurisdiction',
      jurisdiction_id: jurisdictionId.toString(),
    });

    // Find all kitchens in this jurisdiction
    const kitchens = await Kitchen.find({ jurisdiction_id: jurisdictionId });

    if (kitchens.length === 0) {
      logger.info({ msg: 'No kitchens found in jurisdiction' });
      return { queued: 0 };
    }

    const kitchenIds = kitchens.map((k) => k._id);

    // Find all vendors in these kitchens
    const vendors = await Vendor.find({
      kitchen_id: { $in: kitchenIds },
      status: { $in: [VENDOR_STATUS.VERIFIED, VENDOR_STATUS.NEEDS_REVIEW] },
    });

    logger.info({
      msg: 'Found vendors to re-verify',
      vendor_count: vendors.length,
    });

    // Trigger verification for each vendor
    // In production, this would enqueue jobs instead of running synchronously
    let queued = 0;
    for (const vendor of vendors) {
      try {
        await this.triggerVerification(
          vendor._id.toString(),
          vendor.tenant_id,
          VERIFICATION_TRIGGER.REGULATION_UPDATE
        );
        queued++;
      } catch (error) {
        logger.error({
          msg: 'Failed to trigger re-verification',
          vendor_id: vendor._id.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { queued };
  }

  /**
   * Get verification statistics for a tenant
   */
  static async getVerificationStats(tenantId: mongoose.Types.ObjectId): Promise<{
    total_vendors: number;
    verified: number;
    pending: number;
    needs_review: number;
    rejected: number;
    expired: number;
    suspended: number;
  }> {
    const pipeline = [
      { $match: { tenant_id: tenantId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ];

    const results = await Vendor.aggregate(pipeline);

    const stats = {
      total_vendors: 0,
      verified: 0,
      pending: 0,
      needs_review: 0,
      rejected: 0,
      expired: 0,
      suspended: 0,
    };

    for (const result of results) {
      stats.total_vendors += result.count;
      const status = result._id as keyof typeof stats;
      if (status in stats) {
        stats[status] = result.count;
      }
    }

    return stats;
  }
}
