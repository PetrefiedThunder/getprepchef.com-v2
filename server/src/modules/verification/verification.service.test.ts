/**
 * VerificationService Unit Tests
 * Tests for vendor verification logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VerificationService } from './verification.service';
import { VerificationRun } from './verification_run.model';
import { Vendor } from '../vendors/vendor.model';
import { Kitchen } from '../kitchens/kitchen.model';
import { RegRequirement } from '../regintel/reg_requirement.model';
import * as verificationRules from './verification.rules';

// Mock dependencies
vi.mock('./verification_run.model');
vi.mock('../vendors/vendor.model');
vi.mock('../kitchens/kitchen.model');
vi.mock('../regintel/reg_requirement.model');
vi.mock('./verification.rules');

describe('VerificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('triggerVerification', () => {
    it('should create and execute verification run', async () => {
      const mockVendor = {
        _id: 'vendor123',
        business_name: 'Test Vendor',
        status: 'pending',
        kitchen_id: 'kitchen123',
        legal_entity_type: 'llc',
        updateStatus: vi.fn().mockResolvedValue(true),
      };

      const mockKitchen = {
        _id: 'kitchen123',
        jurisdiction_id: 'jurisdiction123',
        type: 'shared',
      };

      const mockRequirements = [
        {
          _id: 'req1',
          name: 'Business License',
          requirement_type: 'business_license',
        },
        {
          _id: 'req2',
          name: 'Health Permit',
          requirement_type: 'health_permit',
        },
      ];

      const mockVerificationRun = {
        _id: 'run123',
        vendor_id: 'vendor123',
        status: 'pending',
        complete: vi.fn().mockResolvedValue(true),
        fail: vi.fn().mockResolvedValue(true),
        save: vi.fn().mockResolvedValue(true),
      };

      const mockVerificationResult = {
        outcome: 'verified' as const,
        checklist: {
          items: [
            {
              requirement_id: 'req1',
              requirement_name: 'Business License',
              requirement_type: 'business_license',
              status: 'satisfied' as const,
            },
            {
              requirement_id: 'req2',
              requirement_name: 'Health Permit',
              requirement_type: 'health_permit',
              status: 'satisfied' as const,
            },
          ],
          total_items: 2,
          satisfied_items: 2,
          completion_percentage: 100,
        },
        reason: 'All requirements satisfied',
      };

      vi.mocked(Vendor.findById).mockResolvedValue(mockVendor as any);
      vi.mocked(Kitchen.findById).mockResolvedValue(mockKitchen as any);
      vi.mocked(RegRequirement.findApplicable).mockResolvedValue(
        mockRequirements as any
      );
      vi.mocked(VerificationRun).mockImplementation(
        () => mockVerificationRun as any
      );
      vi.mocked(verificationRules.verifyVendor).mockResolvedValue(
        mockVerificationResult
      );

      const result = await VerificationService.triggerVerification('vendor123');

      expect(result).toHaveProperty('_id');
      expect(Vendor.findById).toHaveBeenCalledWith('vendor123');
      expect(Kitchen.findById).toHaveBeenCalledWith('kitchen123');
      expect(RegRequirement.findApplicable).toHaveBeenCalled();
      expect(verificationRules.verifyVendor).toHaveBeenCalled();
      expect(mockVerificationRun.complete).toHaveBeenCalled();
      expect(mockVendor.updateStatus).toHaveBeenCalledWith('verified');
    });

    it('should throw error if vendor not found', async () => {
      vi.mocked(Vendor.findById).mockResolvedValue(null);

      await expect(
        VerificationService.triggerVerification('invalid_vendor')
      ).rejects.toThrow('Vendor not found');
    });

    it('should handle verification failure', async () => {
      const mockVendor = {
        _id: 'vendor123',
        kitchen_id: 'kitchen123',
        legal_entity_type: 'llc',
      };

      const mockKitchen = {
        _id: 'kitchen123',
        jurisdiction_id: 'jurisdiction123',
        type: 'shared',
      };

      const mockVerificationRun = {
        _id: 'run123',
        fail: vi.fn().mockResolvedValue(true),
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(Vendor.findById).mockResolvedValue(mockVendor as any);
      vi.mocked(Kitchen.findById).mockResolvedValue(mockKitchen as any);
      vi.mocked(VerificationRun).mockImplementation(
        () => mockVerificationRun as any
      );
      vi.mocked(RegRequirement.findApplicable).mockRejectedValue(
        new Error('Database error')
      );

      const result = await VerificationService.triggerVerification('vendor123');

      expect(mockVerificationRun.fail).toHaveBeenCalled();
    });

    it('should update vendor status based on verification outcome', async () => {
      const mockVendor = {
        _id: 'vendor123',
        kitchen_id: 'kitchen123',
        legal_entity_type: 'llc',
        updateStatus: vi.fn().mockResolvedValue(true),
      };

      const mockKitchen = {
        _id: 'kitchen123',
        jurisdiction_id: 'jurisdiction123',
        type: 'shared',
      };

      const mockVerificationRun = {
        _id: 'run123',
        complete: vi.fn().mockResolvedValue(true),
        save: vi.fn().mockResolvedValue(true),
      };

      const mockVerificationResult = {
        outcome: 'needs_review' as const,
        checklist: {
          items: [],
          total_items: 2,
          satisfied_items: 1,
          completion_percentage: 50,
        },
        reason: 'Incomplete documentation',
      };

      vi.mocked(Vendor.findById).mockResolvedValue(mockVendor as any);
      vi.mocked(Kitchen.findById).mockResolvedValue(mockKitchen as any);
      vi.mocked(RegRequirement.findApplicable).mockResolvedValue([]);
      vi.mocked(VerificationRun).mockImplementation(
        () => mockVerificationRun as any
      );
      vi.mocked(verificationRules.verifyVendor).mockResolvedValue(
        mockVerificationResult
      );

      await VerificationService.triggerVerification('vendor123');

      expect(mockVendor.updateStatus).toHaveBeenCalledWith('needs_review');
    });
  });

  describe('getVerificationHistory', () => {
    it('should return verification runs for vendor', async () => {
      const mockVendor = {
        _id: 'vendor123',
      };

      const mockRuns = [
        {
          _id: 'run1',
          vendor_id: 'vendor123',
          status: 'completed',
          outcome: 'verified',
        },
        {
          _id: 'run2',
          vendor_id: 'vendor123',
          status: 'completed',
          outcome: 'needs_review',
        },
      ];

      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockRuns),
      };

      vi.mocked(Vendor.findById).mockResolvedValue(mockVendor as any);
      vi.mocked(VerificationRun.find).mockReturnValue(mockQuery as any);

      const result = await VerificationService.getVerificationHistory('vendor123');

      expect(result).toHaveLength(2);
      expect(VerificationRun.find).toHaveBeenCalledWith({
        vendor_id: 'vendor123',
      });
      expect(mockQuery.sort).toHaveBeenCalledWith({ created_at: -1 });
    });

    it('should throw error if vendor not found', async () => {
      vi.mocked(Vendor.findById).mockResolvedValue(null);

      await expect(
        VerificationService.getVerificationHistory('invalid_vendor')
      ).rejects.toThrow('Vendor not found');
    });
  });

  describe('getVerificationRun', () => {
    it('should return specific verification run', async () => {
      const mockRun = {
        _id: 'run123',
        vendor_id: 'vendor123',
        status: 'completed',
        outcome: 'verified',
      };

      vi.mocked(VerificationRun.findById).mockResolvedValue(mockRun as any);

      const result = await VerificationService.getVerificationRun('run123');

      expect(result._id).toBe('run123');
      expect(VerificationRun.findById).toHaveBeenCalledWith('run123');
    });

    it('should throw error if run not found', async () => {
      vi.mocked(VerificationRun.findById).mockResolvedValue(null);

      await expect(
        VerificationService.getVerificationRun('invalid_run')
      ).rejects.toThrow('Verification run not found');
    });
  });

  describe('getVerificationStats', () => {
    it('should return aggregated vendor statistics', async () => {
      const mockStats = [
        { _id: 'verified', count: 10 },
        { _id: 'pending', count: 5 },
        { _id: 'needs_review', count: 3 },
        { _id: 'expired', count: 2 },
      ];

      vi.mocked(Vendor.aggregate).mockResolvedValue(mockStats as any);

      const result = await VerificationService.getVerificationStats('tenant123');

      expect(result).toHaveProperty('total_vendors');
      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('pending');
      expect(result.total_vendors).toBe(20);
      expect(result.verified).toBe(10);
      expect(Vendor.aggregate).toHaveBeenCalled();
    });

    it('should return zero counts for empty tenant', async () => {
      vi.mocked(Vendor.aggregate).mockResolvedValue([]);

      const result = await VerificationService.getVerificationStats('tenant123');

      expect(result.total_vendors).toBe(0);
      expect(result.verified).toBe(0);
      expect(result.pending).toBe(0);
    });
  });

  describe('reverifyJurisdiction', () => {
    it('should trigger verification for all vendors in jurisdiction', async () => {
      const mockKitchens = [
        { _id: 'kitchen1', jurisdiction_id: 'jurisdiction123' },
        { _id: 'kitchen2', jurisdiction_id: 'jurisdiction123' },
      ];

      const mockVendors = [
        { _id: 'vendor1', kitchen_id: 'kitchen1' },
        { _id: 'vendor2', kitchen_id: 'kitchen2' },
      ];

      vi.mocked(Kitchen.find).mockResolvedValue(mockKitchens as any);
      vi.mocked(Vendor.find).mockResolvedValue(mockVendors as any);

      // Mock the triggerVerification to avoid actual execution
      const triggerSpy = vi
        .spyOn(VerificationService, 'triggerVerification')
        .mockResolvedValue({} as any);

      await VerificationService.reverifyJurisdiction('jurisdiction123');

      expect(Kitchen.find).toHaveBeenCalledWith({
        jurisdiction_id: 'jurisdiction123',
      });
      expect(Vendor.find).toHaveBeenCalled();
      expect(triggerSpy).toHaveBeenCalledTimes(2);
    });
  });
});
