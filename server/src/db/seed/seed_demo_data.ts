import mongoose from 'mongoose';
import logger from '@/lib/logger';
import { connectDatabase, disconnectDatabase } from '@/db/connection';
import { User } from '@/modules/users/user.model';
import { Tenant } from '@/modules/tenants/tenant.model';
import { Kitchen } from '@/modules/kitchens/kitchen.model';
import { Vendor } from '@/modules/vendors/vendor.model';
import { VendorPerson } from '@/modules/vendors/vendor_person.model';
import { VendorDocument } from '@/modules/documents/document.model';
import { Jurisdiction } from '@/modules/regintel/jurisdiction.model';

/**
 * Seed Demo Data
 * Creates sample tenants, kitchens, vendors for testing and demos
 */

async function seedDemoData(): Promise<void> {
  try {
    logger.info('Starting demo data seeding...');

    // Connect to database
    await connectDatabase();

    // Clear existing demo data
    await User.deleteMany({});
    await Tenant.deleteMany({});
    await Kitchen.deleteMany({});
    await Vendor.deleteMany({});
    await VendorPerson.deleteMany({});
    await VendorDocument.deleteMany({});

    logger.info('Cleared existing demo data');

    // Get LA County jurisdiction
    const laCounty = await Jurisdiction.findOne({ code: 'US-CA-LAC' });
    if (!laCounty) {
      throw new Error('LA County jurisdiction not found. Run seed_regulations.ts first!');
    }

    // Create demo tenant
    const demoTenant = await Tenant.create({
      name: 'Kitchen Collective LA',
      type: 'kitchen_operator',
      contact_email: 'admin@kitchencollective-la.com',
      status: 'active',
    });

    // Generate API key for demo tenant
    const { key, key_hash } = await demoTenant.generateApiKey('Production API Key');
    logger.info(`Demo tenant API key: ${key}`);
    logger.info('⚠️ SAVE THIS API KEY - it will not be shown again!');

    // Create demo admin user
    const adminPasswordHash = await User.hashPassword('Admin1234!');
    const adminUser = await User.create({
      tenant_id: demoTenant._id,
      email: 'admin@kitchencollective-la.com',
      password_hash: adminPasswordHash,
      first_name: 'Sarah',
      last_name: 'Johnson',
      role: 'tenant_owner',
      status: 'active',
    });

    logger.info(`Created admin user: ${adminUser.email} / Admin1234!`);

    // Create demo kitchens
    const downtownKitchen = await Kitchen.create({
      tenant_id: demoTenant._id,
      jurisdiction_id: laCounty._id,
      name: 'Downtown LA Shared Kitchen',
      address: {
        street: '1234 Main Street',
        city: 'Los Angeles',
        county: 'Los Angeles',
        state: 'CA',
        zip: '90012',
        country: 'US',
      },
      type: 'shared',
      capacity: 12,
      status: 'active',
    });

    const culverKitchen = await Kitchen.create({
      tenant_id: demoTenant._id,
      jurisdiction_id: laCounty._id,
      name: 'Culver City Commissary',
      address: {
        street: '5678 Culver Blvd',
        city: 'Culver City',
        county: 'Los Angeles',
        state: 'CA',
        zip: '90232',
        country: 'US',
      },
      type: 'commissary',
      capacity: 20,
      status: 'active',
    });

    logger.info(`Created ${2} demo kitchens`);

    // Create demo vendors
    const vendors = [];

    // Vendor 1: Verified
    const vendor1 = await Vendor.create({
      tenant_id: demoTenant._id,
      kitchen_id: downtownKitchen._id,
      business_name: 'Tasty Tacos LA',
      dba_name: 'Tasty Tacos',
      legal_entity_type: 'llc',
      business_address: {
        street: '100 Taco Lane',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
        country: 'US',
      },
      contact: {
        email: 'owner@tastytacos-la.com',
        phone: '+13105551234',
        primary_contact_name: 'Maria Rodriguez',
      },
      status: 'verified',
      last_verified_at: new Date(),
    });
    vendors.push(vendor1);

    // Vendor 2: Pending
    const vendor2 = await Vendor.create({
      tenant_id: demoTenant._id,
      kitchen_id: downtownKitchen._id,
      business_name: 'Gourmet Burgers Inc',
      legal_entity_type: 'corporation',
      business_address: {
        street: '200 Burger Ave',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90002',
        country: 'US',
      },
      contact: {
        email: 'contact@gourmetburgers.com',
        phone: '+13105555678',
        primary_contact_name: 'John Smith',
      },
      status: 'pending',
    });
    vendors.push(vendor2);

    // Vendor 3: Needs Review
    const vendor3 = await Vendor.create({
      tenant_id: demoTenant._id,
      kitchen_id: culverKitchen._id,
      business_name: 'Vegan Delights',
      legal_entity_type: 'sole_proprietorship',
      business_address: {
        street: '300 Plant Street',
        city: 'Culver City',
        state: 'CA',
        zip: '90230',
        country: 'US',
      },
      contact: {
        email: 'hello@vegandelights.com',
        phone: '+13105559999',
        primary_contact_name: 'Emily Green',
      },
      status: 'needs_review',
    });
    vendors.push(vendor3);

    // Vendor 4: Expired
    const vendor4 = await Vendor.create({
      tenant_id: demoTenant._id,
      kitchen_id: culverKitchen._id,
      business_name: 'Pizza Paradise',
      dba_name: 'Pizza Paradise LA',
      legal_entity_type: 'llc',
      business_address: {
        street: '400 Pizza Plaza',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90003',
        country: 'US',
      },
      contact: {
        email: 'info@pizzaparadise-la.com',
        phone: '+13105551111',
        primary_contact_name: 'Tony Marino',
      },
      status: 'expired',
      last_verified_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), // 120 days ago
    });
    vendors.push(vendor4);

    logger.info(`Created ${vendors.length} demo vendors`);

    // Create vendor persons
    await VendorPerson.create({
      vendor_id: vendor1._id,
      first_name: 'Maria',
      last_name: 'Rodriguez',
      role: 'owner',
      ownership_percentage: 100,
      email: 'maria@tastytacos-la.com',
      phone: '+13105551234',
    });

    await VendorPerson.create({
      vendor_id: vendor2._id,
      first_name: 'John',
      last_name: 'Smith',
      role: 'owner',
      ownership_percentage: 60,
      email: 'john@gourmetburgers.com',
      phone: '+13105555678',
    });

    logger.info('Created vendor persons');

    // Create sample documents (metadata only, no actual files)
    const sampleDocs = [
      {
        vendor_id: vendor1._id,
        document_type: 'business_license',
        status: 'approved',
        issue_date: new Date('2024-01-15'),
        expiration_date: new Date('2025-01-15'),
        document_number: 'BL-2024-123456',
      },
      {
        vendor_id: vendor1._id,
        document_type: 'health_permit',
        status: 'approved',
        issue_date: new Date('2024-02-01'),
        expiration_date: new Date('2025-02-01'),
        document_number: 'HP-2024-789012',
      },
      {
        vendor_id: vendor1._id,
        document_type: 'insurance_certificate',
        status: 'approved',
        issue_date: new Date('2024-01-01'),
        expiration_date: new Date('2025-01-01'),
        issuing_authority: 'State Farm Insurance',
      },
    ];

    for (const doc of sampleDocs) {
      await VendorDocument.create({
        ...doc,
        file_metadata: {
          storage_key: `demo/${doc.vendor_id}/${doc.document_type}.pdf`,
          filename: `${doc.document_type}.pdf`,
          mimetype: 'application/pdf',
          size_bytes: 102400, // 100KB
          uploaded_at: new Date(),
        },
      });
    }

    logger.info(`Created ${sampleDocs.length} sample documents`);

    logger.info('✅ Demo data seeding complete!');
    logger.info('');
    logger.info('='.repeat(60));
    logger.info('DEMO CREDENTIALS:');
    logger.info('='.repeat(60));
    logger.info(`Admin Email:    ${adminUser.email}`);
    logger.info(`Admin Password: Admin1234!`);
    logger.info(`API Key:        ${key}`);
    logger.info('');
    logger.info(`Tenant: ${demoTenant.name} (ID: ${demoTenant._id})`);
    logger.info(`Kitchens: ${2}`);
    logger.info(`Vendors: ${vendors.length}`);
    logger.info('='.repeat(60));

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    logger.error({
      msg: 'Failed to seed demo data',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedDemoData();
}

export { seedDemoData };
