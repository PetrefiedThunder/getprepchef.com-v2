/**
 * VendorService Unit Tests
 * Tests for vendor management operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VendorService } from './vendor.service';
import { Vendor } from './vendor.model';
import { Kitchen } from '../kitchens/kitchen.model';
import { VendorPerson } from './vendor_person.model';

// Mock models
vi.mock('./vendor.model');
vi.mock('../kitchens/kitchen.model');
vi.mock('./vendor_person.model');

describe('VendorService', () => {
  const mockTenantId = 'tenant123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createVendor', () => {
    it('should create a new vendor', async () => {
      const mockKitchen = {
        _id: 'kitchen123',
        tenant_id: 'tenant123',
        jurisdiction_id: 'jurisdiction123',
      };

      const mockVendor = {
        _id: 'vendor123',
        business_name: 'Test Vendor LLC',
        legal_entity_type: 'llc',
        status: 'pending',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(Kitchen.findById).mockResolvedValue(mockKitchen as any);
      vi.mocked(Vendor).mockImplementation(() => mockVendor as any);
      vi.mocked(Vendor.findOne).mockResolvedValue(null); // No duplicate

      const vendorData = {
        kitchen_id: 'kitchen123',
        business_name: 'Test Vendor LLC',
        legal_entity_type: 'llc' as const,
        business_address: {
          street: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001',
          country: 'US',
        },
        contact: {
          email: 'test@vendor.com',
          phone: '+13105551234',
          primary_contact_name: 'John Doe',
        },
      };

      const result = await VendorService.createVendor(mockTenantId, vendorData);

      expect(result).toHaveProperty('_id');
      expect(result.business_name).toBe('Test Vendor LLC');
      expect(Kitchen.findById).toHaveBeenCalledWith('kitchen123');
      expect(mockVendor.save).toHaveBeenCalled();
    });

    it('should throw error if kitchen not found', async () => {
      vi.mocked(Kitchen.findById).mockResolvedValue(null);

      await expect(
        VendorService.createVendor(mockTenantId, {
          kitchen_id: 'invalid_kitchen',
          business_name: 'Test Vendor',
          legal_entity_type: 'llc',
          business_address: {} as any,
          contact: {} as any,
        })
      ).rejects.toThrow('Kitchen not found');
    });

    it('should throw error if kitchen belongs to different tenant', async () => {
      const mockKitchen = {
        _id: 'kitchen123',
        tenant_id: 'different_tenant',
      };

      vi.mocked(Kitchen.findById).mockResolvedValue(mockKitchen as any);

      await expect(
        VendorService.createVendor(mockTenantId, {
          kitchen_id: 'kitchen123',
          business_name: 'Test Vendor',
          legal_entity_type: 'llc',
          business_address: {} as any,
          contact: {} as any,
        })
      ).rejects.toThrow('Kitchen does not belong to this tenant');
    });

    it('should throw error if duplicate vendor exists', async () => {
      const mockKitchen = {
        _id: 'kitchen123',
        tenant_id: 'tenant123',
      };

      const existingVendor = {
        _id: 'existing_vendor',
        business_name: 'Test Vendor LLC',
      };

      vi.mocked(Kitchen.findById).mockResolvedValue(mockKitchen as any);
      vi.mocked(Vendor.findOne).mockResolvedValue(existingVendor as any);

      await expect(
        VendorService.createVendor(mockTenantId, {
          kitchen_id: 'kitchen123',
          business_name: 'Test Vendor LLC',
          legal_entity_type: 'llc',
          business_address: {} as any,
          contact: {} as any,
        })
      ).rejects.toThrow('Vendor with this business name already exists');
    });
  });

  describe('listVendors', () => {
    it('should return paginated list of vendors', async () => {
      const mockVendors = [
        { _id: 'vendor1', business_name: 'Vendor 1', status: 'verified' },
        { _id: 'vendor2', business_name: 'Vendor 2', status: 'pending' },
      ];

      const mockQuery = {
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockVendors),
      };

      vi.mocked(Vendor.find).mockReturnValue(mockQuery as any);
      vi.mocked(Vendor.countDocuments).mockResolvedValue(2);

      const result = await VendorService.listVendors(mockTenantId, {
        page: 1,
        limit: 10,
      });

      expect(result.vendors).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(Vendor.find).toHaveBeenCalledWith({ tenant_id: mockTenantId });
    });

    it('should filter by status', async () => {
      const mockQuery = {
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(Vendor.find).mockReturnValue(mockQuery as any);
      vi.mocked(Vendor.countDocuments).mockResolvedValue(0);

      await VendorService.listVendors(mockTenantId, {
        status: 'verified',
        page: 1,
        limit: 10,
      });

      expect(Vendor.find).toHaveBeenCalledWith({
        tenant_id: mockTenantId,
        status: 'verified',
      });
    });

    it('should search by business name', async () => {
      const mockQuery = {
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(Vendor.find).mockReturnValue(mockQuery as any);
      vi.mocked(Vendor.countDocuments).mockResolvedValue(0);

      await VendorService.listVendors(mockTenantId, {
        search: 'Tacos',
        page: 1,
        limit: 10,
      });

      expect(Vendor.find).toHaveBeenCalledWith({
        tenant_id: mockTenantId,
        $text: { $search: 'Tacos' },
      });
    });
  });

  describe('getVendorWithDetails', () => {
    it('should return vendor with persons and documents', async () => {
      const mockVendor = {
        _id: 'vendor123',
        business_name: 'Test Vendor',
        tenant_id: 'tenant123',
      };

      const mockPersons = [
        { _id: 'person1', first_name: 'John', last_name: 'Doe' },
      ];

      const mockDocuments = [
        { _id: 'doc1', document_type: 'business_license' },
      ];

      vi.mocked(Vendor.findById).mockResolvedValue(mockVendor as any);
      vi.mocked(VendorPerson.find).mockResolvedValue(mockPersons as any);
      vi.mocked(Vendor.findOne).mockImplementation((query: any) => {
        if (query._id) {
          return {
            populate: vi.fn().mockResolvedValue({
              ...mockVendor,
              documents: mockDocuments,
            }),
          } as any;
        }
        return null as any;
      });

      const result = await VendorService.getVendorWithDetails(
        mockTenantId,
        'vendor123'
      );

      expect(result).toHaveProperty('vendor');
      expect(result).toHaveProperty('persons');
      expect(result.persons).toHaveLength(1);
    });

    it('should throw error if vendor not found', async () => {
      vi.mocked(Vendor.findById).mockResolvedValue(null);

      await expect(
        VendorService.getVendorWithDetails(mockTenantId, 'invalid_vendor')
      ).rejects.toThrow('Vendor not found');
    });

    it('should throw error if vendor belongs to different tenant', async () => {
      const mockVendor = {
        _id: 'vendor123',
        tenant_id: 'different_tenant',
      };

      vi.mocked(Vendor.findById).mockResolvedValue(mockVendor as any);

      await expect(
        VendorService.getVendorWithDetails(mockTenantId, 'vendor123')
      ).rejects.toThrow('Vendor not found');
    });
  });

  describe('updateVendor', () => {
    it('should update vendor fields', async () => {
      const mockVendor = {
        _id: 'vendor123',
        tenant_id: 'tenant123',
        business_name: 'Old Name',
        dba_name: null,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(Vendor.findById).mockResolvedValue(mockVendor as any);

      const updates = {
        dba_name: 'Doing Business As Name',
      };

      const result = await VendorService.updateVendor(
        mockTenantId,
        'vendor123',
        updates
      );

      expect(result.dba_name).toBe('Doing Business As Name');
      expect(mockVendor.save).toHaveBeenCalled();
    });

    it('should throw error if updating protected fields', async () => {
      const mockVendor = {
        _id: 'vendor123',
        tenant_id: 'tenant123',
      };

      vi.mocked(Vendor.findById).mockResolvedValue(mockVendor as any);

      await expect(
        VendorService.updateVendor(mockTenantId, 'vendor123', {
          status: 'verified', // Protected field
        })
      ).rejects.toThrow('Cannot update status directly');
    });
  });

  describe('deleteVendor', () => {
    it('should soft delete vendor', async () => {
      const mockVendor = {
        _id: 'vendor123',
        tenant_id: 'tenant123',
        status: 'pending',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(Vendor.findById).mockResolvedValue(mockVendor as any);

      await VendorService.deleteVendor(mockTenantId, 'vendor123');

      expect(mockVendor.status).toBe('suspended');
      expect(mockVendor.save).toHaveBeenCalled();
    });
  });

  describe('addPerson', () => {
    it('should add person to vendor', async () => {
      const mockVendor = {
        _id: 'vendor123',
        tenant_id: 'tenant123',
        persons: [],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockPerson = {
        _id: 'person123',
        vendor_id: 'vendor123',
        first_name: 'John',
        last_name: 'Doe',
        role: 'owner',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(Vendor.findById).mockResolvedValue(mockVendor as any);
      vi.mocked(VendorPerson).mockImplementation(() => mockPerson as any);

      const personData = {
        first_name: 'John',
        last_name: 'Doe',
        role: 'owner' as const,
        ownership_percentage: 100,
      };

      const result = await VendorService.addPerson(
        mockTenantId,
        'vendor123',
        personData
      );

      expect(result.first_name).toBe('John');
      expect(mockPerson.save).toHaveBeenCalled();
      expect(mockVendor.persons).toContain('person123');
      expect(mockVendor.save).toHaveBeenCalled();
    });
  });
});
