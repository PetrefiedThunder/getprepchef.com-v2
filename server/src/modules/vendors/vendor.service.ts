import mongoose from 'mongoose';
import { Vendor, IVendor } from './vendor.model';
import { VendorPerson, IVendorPerson } from './vendor_person.model';
import { VendorDocument, IVendorDocument } from '@/modules/documents/document.model';
import { Kitchen } from '@/modules/kitchens/kitchen.model';
import { NotFoundError, ValidationError, ConflictError } from '@/middleware/error_handler';
import logger from '@/lib/logger';
import { VendorStatus } from '@/config/constants';

/**
 * Vendor Service
 * Business logic for vendor management
 */

export interface ICreateVendorInput {
  tenant_id: mongoose.Types.ObjectId;
  kitchen_id: mongoose.Types.ObjectId;
  business_name: string;
  dba_name?: string;
  legal_entity_type: string;
  tax_id_encrypted?: string;
  business_address: {
    street: string;
    city: string;
    county?: string;
    state: string;
    zip: string;
    country?: string;
  };
  contact: {
    email: string;
    phone: string;
    primary_contact_name?: string;
  };
  metadata?: Record<string, any>;
}

export interface IUpdateVendorInput {
  business_name?: string;
  dba_name?: string;
  legal_entity_type?: string;
  business_address?: Partial<ICreateVendorInput['business_address']>;
  contact?: Partial<ICreateVendorInput['contact']>;
  metadata?: Record<string, any>;
}

export interface IVendorFilters {
  status?: VendorStatus;
  kitchen_id?: string;
  search?: string;
}

export class VendorService {
  /**
   * Create a new vendor
   */
  static async createVendor(input: ICreateVendorInput): Promise<IVendor> {
    logger.info({
      msg: 'Creating vendor',
      tenant_id: input.tenant_id.toString(),
      kitchen_id: input.kitchen_id.toString(),
      business_name: input.business_name,
    });

    // Verify kitchen exists and belongs to tenant
    const kitchen = await Kitchen.findById(input.kitchen_id);
    if (!kitchen) {
      throw new NotFoundError('Kitchen');
    }

    if (kitchen.tenant_id.toString() !== input.tenant_id.toString()) {
      throw new ValidationError('Kitchen does not belong to this tenant');
    }

    // Check for duplicate vendor name in same kitchen
    const existingVendor = await Vendor.findOne({
      tenant_id: input.tenant_id,
      kitchen_id: input.kitchen_id,
      business_name: input.business_name,
    });

    if (existingVendor) {
      throw new ConflictError('Vendor with this name already exists in this kitchen');
    }

    // Create vendor
    const vendor = await Vendor.create(input);

    logger.info({
      msg: 'Vendor created',
      vendor_id: vendor._id.toString(),
    });

    return vendor;
  }

  /**
   * Get vendor by ID (with tenant isolation)
   */
  static async getVendorById(
    vendorId: string,
    tenantId: mongoose.Types.ObjectId
  ): Promise<IVendor> {
    const vendor = await Vendor.findOne({
      _id: new mongoose.Types.ObjectId(vendorId),
      tenant_id: tenantId,
    })
      .populate('kitchen_id', 'name address')
      .populate('persons')
      .populate('documents');

    if (!vendor) {
      throw new NotFoundError('Vendor');
    }

    return vendor;
  }

  /**
   * List vendors with filters
   */
  static async listVendors(
    tenantId: mongoose.Types.ObjectId,
    filters?: IVendorFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ vendors: IVendor[]; total: number; page: number; totalPages: number }> {
    const query: any = { tenant_id: tenantId };

    // Apply filters
    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.kitchen_id) {
      query.kitchen_id = new mongoose.Types.ObjectId(filters.kitchen_id);
    }

    if (filters?.search) {
      query.$text = { $search: filters.search };
    }

    // Count total
    const total = await Vendor.countDocuments(query);

    // Get paginated results
    const vendors = await Vendor.find(query)
      .populate('kitchen_id', 'name address')
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      vendors,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update vendor
   */
  static async updateVendor(
    vendorId: string,
    tenantId: mongoose.Types.ObjectId,
    input: IUpdateVendorInput
  ): Promise<IVendor> {
    const vendor = await this.getVendorById(vendorId, tenantId);

    // Update fields
    if (input.business_name) vendor.business_name = input.business_name;
    if (input.dba_name !== undefined) vendor.dba_name = input.dba_name;
    if (input.legal_entity_type) vendor.legal_entity_type = input.legal_entity_type as any;

    if (input.business_address) {
      vendor.business_address = {
        ...vendor.business_address,
        ...input.business_address,
      };
    }

    if (input.contact) {
      vendor.contact = {
        ...vendor.contact,
        ...input.contact,
      };
    }

    if (input.metadata) {
      vendor.metadata = {
        ...vendor.metadata,
        ...input.metadata,
      };
    }

    await vendor.save();

    logger.info({
      msg: 'Vendor updated',
      vendor_id: vendor._id.toString(),
    });

    return vendor;
  }

  /**
   * Delete vendor (soft delete - mark as suspended)
   */
  static async deleteVendor(
    vendorId: string,
    tenantId: mongoose.Types.ObjectId
  ): Promise<void> {
    const vendor = await this.getVendorById(vendorId, tenantId);

    await vendor.updateStatus('suspended' as VendorStatus);

    logger.info({
      msg: 'Vendor deleted',
      vendor_id: vendor._id.toString(),
    });
  }

  /**
   * Add person to vendor
   */
  static async addPerson(
    vendorId: string,
    tenantId: mongoose.Types.ObjectId,
    personData: Partial<IVendorPerson>
  ): Promise<IVendorPerson> {
    const vendor = await this.getVendorById(vendorId, tenantId);

    const person = await VendorPerson.create({
      ...personData,
      vendor_id: vendor._id,
    });

    // Add to vendor's persons array
    vendor.persons.push(person._id);
    await vendor.save();

    logger.info({
      msg: 'Person added to vendor',
      vendor_id: vendor._id.toString(),
      person_id: person._id.toString(),
    });

    return person;
  }

  /**
   * Get vendor with full details (persons, documents)
   */
  static async getVendorWithDetails(
    vendorId: string,
    tenantId: mongoose.Types.ObjectId
  ): Promise<{
    vendor: IVendor;
    persons: IVendorPerson[];
    documents: IVendorDocument[];
  }> {
    const vendor = await this.getVendorById(vendorId, tenantId);

    const persons = await VendorPerson.findByVendor(vendor._id);
    const documents = await VendorDocument.findByVendor(vendor._id);

    return {
      vendor,
      persons,
      documents,
    };
  }

  /**
   * Get vendors needing verification
   */
  static async getVendorsNeedingVerification(
    tenantId: mongoose.Types.ObjectId,
    daysSinceLastVerification: number = 90
  ): Promise<IVendor[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysSinceLastVerification);

    return Vendor.find({
      tenant_id: tenantId,
      $or: [
        { last_verified_at: null },
        { last_verified_at: { $lt: thresholdDate } },
        { status: { $in: ['pending', 'needs_review'] } },
      ],
    })
      .populate('kitchen_id', 'name')
      .sort({ created_at: 1 });
  }
}
