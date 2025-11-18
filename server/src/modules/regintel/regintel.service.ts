import mongoose from 'mongoose';
import { Jurisdiction, IJurisdiction } from './jurisdiction.model';
import { HealthDept, IHealthDept } from './health_dept.model';
import { RegRequirement, IRegRequirement } from './reg_requirement.model';
import { RegUpdateLog, IRegUpdateLog } from './reg_update_log.model';
import { NotFoundError } from '@/middleware/error_handler';
import logger from '@/lib/logger';

/**
 * Regulatory Intelligence Service
 * Provides access to regulatory data and requirements
 */

export interface IChecklistQuery {
  jurisdiction_id?: string;
  state?: string;
  county?: string;
  kitchen_type: string;
  vendor_type?: string;
  entity_type: string;
}

export class RegIntelService {
  /**
   * Get jurisdiction by code
   */
  static async getJurisdictionByCode(code: string): Promise<IJurisdiction | null> {
    return Jurisdiction.findByCode(code);
  }

  /**
   * Get jurisdiction hierarchy (from specific to country)
   */
  static async getJurisdictionHierarchy(
    jurisdictionId: string
  ): Promise<IJurisdiction[]> {
    return Jurisdiction.buildHierarchy(new mongoose.Types.ObjectId(jurisdictionId));
  }

  /**
   * Find jurisdiction by address components
   */
  static async findJurisdictionByAddress(
    state: string,
    county?: string,
    city?: string
  ): Promise<IJurisdiction | null> {
    // Try to find most specific jurisdiction first
    if (city && county) {
      const cityJurisdiction = await Jurisdiction.findOne({
        type: 'city',
        name: new RegExp(`^${city}$`, 'i'),
      });
      if (cityJurisdiction) return cityJurisdiction;
    }

    if (county) {
      const countyJurisdiction = await Jurisdiction.findOne({
        type: 'county',
        name: new RegExp(`^${county}`, 'i'),
      });
      if (countyJurisdiction) return countyJurisdiction;
    }

    // Fall back to state
    const stateJurisdiction = await Jurisdiction.findOne({
      type: 'state',
      code: { $regex: new RegExp(`^US-${state.toUpperCase()}$`) },
    });

    return stateJurisdiction;
  }

  /**
   * Get health department for a jurisdiction
   */
  static async getHealthDept(jurisdictionId: string): Promise<IHealthDept | null> {
    return HealthDept.findByJurisdiction(new mongoose.Types.ObjectId(jurisdictionId));
  }

  /**
   * Get applicable requirements checklist
   */
  static async getChecklist(query: IChecklistQuery): Promise<{
    jurisdiction: IJurisdiction | null;
    requirements: IRegRequirement[];
    health_dept: IHealthDept | null;
  }> {
    logger.info({
      msg: 'Getting regulatory checklist',
      query,
    });

    // Find jurisdiction
    let jurisdiction: IJurisdiction | null = null;

    if (query.jurisdiction_id) {
      jurisdiction = await Jurisdiction.findById(query.jurisdiction_id);
    } else if (query.state) {
      jurisdiction = await this.findJurisdictionByAddress(query.state, query.county);
    }

    if (!jurisdiction) {
      logger.warn({ msg: 'Jurisdiction not found', query });
      return {
        jurisdiction: null,
        requirements: [],
        health_dept: null,
      };
    }

    // Get applicable requirements
    const requirements = await RegRequirement.findApplicable(
      jurisdiction._id,
      query.kitchen_type,
      query.entity_type
    );

    // Get health department
    const healthDept = await this.getHealthDept(jurisdiction._id.toString());

    logger.info({
      msg: 'Checklist retrieved',
      jurisdiction_id: jurisdiction._id.toString(),
      requirement_count: requirements.length,
      has_health_dept: !!healthDept,
    });

    return {
      jurisdiction,
      requirements,
      health_dept: healthDept,
    };
  }

  /**
   * Get all requirements for a jurisdiction
   */
  static async getJurisdictionRequirements(
    jurisdictionId: string,
    activeOnly: boolean = true
  ): Promise<IRegRequirement[]> {
    const jId = new mongoose.Types.ObjectId(jurisdictionId);

    if (activeOnly) {
      return RegRequirement.findActiveByJurisdiction(jId);
    } else {
      return RegRequirement.findByJurisdiction(jId);
    }
  }

  /**
   * List all jurisdictions with coverage
   */
  static async listJurisdictions(filters?: {
    type?: string;
    coverage_status?: string;
  }): Promise<IJurisdiction[]> {
    const query: any = {};

    if (filters?.type) {
      query.type = filters.type;
    }

    if (filters?.coverage_status) {
      query['metadata.coverage_status'] = filters.coverage_status;
    }

    return Jurisdiction.find(query).sort({ type: 1, name: 1 });
  }

  /**
   * Create regulatory update log
   */
  static async logRegUpdate(
    jurisdictionId: mongoose.Types.ObjectId,
    updateType: string,
    affectedRequirementIds: mongoose.Types.ObjectId[],
    diffSummary: string,
    impactAssessment: {
      affected_vendor_count: number;
      requires_reverification: boolean;
      urgency: 'immediate' | 'high' | 'medium' | 'low';
    }
  ): Promise<IRegUpdateLog> {
    const updateLog = await RegUpdateLog.create({
      jurisdiction_id: jurisdictionId,
      update_type: updateType,
      affected_requirement_ids: affectedRequirementIds,
      diff_summary: diffSummary,
      source: 'manual', // Default for MVP
      detected_at: new Date(),
      impact_assessment: impactAssessment,
    });

    logger.info({
      msg: 'Regulatory update logged',
      update_log_id: updateLog._id.toString(),
      jurisdiction_id: jurisdictionId.toString(),
      urgency: impactAssessment.urgency,
    });

    return updateLog;
  }

  /**
   * Get unprocessed regulatory updates
   */
  static async getUnprocessedUpdates(): Promise<IRegUpdateLog[]> {
    return RegUpdateLog.findUnprocessed();
  }

  /**
   * Get critical regulatory updates
   */
  static async getCriticalUpdates(): Promise<IRegUpdateLog[]> {
    return RegUpdateLog.findCriticalUpdates();
  }

  /**
   * Mark update as processed
   */
  static async markUpdateProcessed(updateId: string): Promise<void> {
    const update = await RegUpdateLog.findById(updateId);
    if (!update) {
      throw new NotFoundError('RegUpdateLog');
    }

    await update.markProcessed();

    logger.info({
      msg: 'Regulatory update marked as processed',
      update_id: updateId,
    });
  }

  /**
   * Get regulatory coverage statistics
   */
  static async getCoverageStats(): Promise<{
    total_jurisdictions: number;
    full_coverage: number;
    partial_coverage: number;
    no_coverage: number;
    total_requirements: number;
  }> {
    const jurisdictions = await Jurisdiction.find();

    const stats = {
      total_jurisdictions: jurisdictions.length,
      full_coverage: 0,
      partial_coverage: 0,
      no_coverage: 0,
      total_requirements: await RegRequirement.countDocuments(),
    };

    for (const jurisdiction of jurisdictions) {
      const coverage = jurisdiction.metadata?.coverage_status || 'none';
      if (coverage === 'full') stats.full_coverage++;
      else if (coverage === 'partial') stats.partial_coverage++;
      else stats.no_coverage++;
    }

    return stats;
  }
}
