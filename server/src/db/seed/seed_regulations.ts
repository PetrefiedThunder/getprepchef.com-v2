import mongoose from 'mongoose';
import { config } from '@/config/env';
import logger from '@/lib/logger';
import { connectDatabase, disconnectDatabase } from '@/db/connection';
import { Jurisdiction } from '@/modules/regintel/jurisdiction.model';
import { HealthDept } from '@/modules/regintel/health_dept.model';
import { RegRequirement } from '@/modules/regintel/reg_requirement.model';

/**
 * Seed Regulatory Data
 * Populates jurisdictions, health departments, and requirements for key US markets
 */

async function seedRegulations(): Promise<void> {
  try {
    logger.info('Starting regulatory data seeding...');

    // Connect to database
    await connectDatabase();

    // Clear existing regulatory data
    await Jurisdiction.deleteMany({});
    await HealthDept.deleteMany({});
    await RegRequirement.deleteMany({});

    logger.info('Cleared existing regulatory data');

    // Create jurisdictions
    const jurisdictions = await seedJurisdictions();
    logger.info(`Created ${jurisdictions.length} jurisdictions`);

    // Create health departments
    const healthDepts = await seedHealthDepts(jurisdictions);
    logger.info(`Created ${healthDepts.length} health departments`);

    // Create regulatory requirements
    const requirements = await seedRequirements(jurisdictions);
    logger.info(`Created ${requirements.length} regulatory requirements`);

    logger.info('✅ Regulatory data seeding complete!');

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    logger.error({
      msg: 'Failed to seed regulatory data',
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

/**
 * Seed jurisdictions (US, states, counties)
 */
async function seedJurisdictions() {
  const jurisdictions = [];

  // United States
  const us = await Jurisdiction.create({
    type: 'country',
    name: 'United States',
    code: 'US',
    metadata: {
      population: 331000000,
      timezone: 'America/New_York',
      regulatory_complexity_score: 8,
      coverage_status: 'partial',
    },
  });
  jurisdictions.push(us);

  // California
  const ca = await Jurisdiction.create({
    type: 'state',
    name: 'California',
    code: 'US-CA',
    parent_id: us._id,
    metadata: {
      population: 39500000,
      timezone: 'America/Los_Angeles',
      regulatory_complexity_score: 9,
      coverage_status: 'full',
    },
  });
  jurisdictions.push(ca);

  // Los Angeles County
  const laCounty = await Jurisdiction.create({
    type: 'county',
    name: 'Los Angeles County',
    code: 'US-CA-LAC',
    parent_id: ca._id,
    metadata: {
      population: 10000000,
      timezone: 'America/Los_Angeles',
      regulatory_complexity_score: 10,
      coverage_status: 'full',
    },
  });
  jurisdictions.push(laCounty);

  // San Francisco County
  const sfCounty = await Jurisdiction.create({
    type: 'county',
    name: 'San Francisco County',
    code: 'US-CA-SFC',
    parent_id: ca._id,
    metadata: {
      population: 875000,
      timezone: 'America/Los_Angeles',
      regulatory_complexity_score: 10,
      coverage_status: 'full',
    },
  });
  jurisdictions.push(sfCounty);

  // New York
  const ny = await Jurisdiction.create({
    type: 'state',
    name: 'New York',
    code: 'US-NY',
    parent_id: us._id,
    metadata: {
      population: 19500000,
      timezone: 'America/New_York',
      regulatory_complexity_score: 9,
      coverage_status: 'partial',
    },
  });
  jurisdictions.push(ny);

  // New York County (Manhattan)
  const nycCounty = await Jurisdiction.create({
    type: 'county',
    name: 'New York County',
    code: 'US-NY-NYC',
    parent_id: ny._id,
    metadata: {
      population: 1600000,
      timezone: 'America/New_York',
      regulatory_complexity_score: 10,
      coverage_status: 'partial',
    },
  });
  jurisdictions.push(nycCounty);

  // Texas
  const tx = await Jurisdiction.create({
    type: 'state',
    name: 'Texas',
    code: 'US-TX',
    parent_id: us._id,
    metadata: {
      population: 29000000,
      timezone: 'America/Chicago',
      regulatory_complexity_score: 7,
      coverage_status: 'partial',
    },
  });
  jurisdictions.push(tx);

  return jurisdictions;
}

/**
 * Seed health departments
 */
async function seedHealthDepts(jurisdictions: any[]) {
  const healthDepts = [];

  // LA County Department of Public Health
  const laCounty = jurisdictions.find((j) => j.code === 'US-CA-LAC');
  if (laCounty) {
    const laHealth = await HealthDept.create({
      jurisdiction_id: laCounty._id,
      name: 'Los Angeles County Department of Public Health',
      website: 'http://publichealth.lacounty.gov',
      contact: {
        email: 'ehmail@ph.lacounty.gov',
        phone: '+18007007415',
        address: {
          street: '5050 Commerce Drive',
          city: 'Baldwin Park',
          state: 'CA',
          zip: '91706',
          country: 'US',
        },
      },
      inspection_portal_url: 'http://publichealth.lacounty.gov/eh/inspection.htm',
      api_available: false,
    });
    healthDepts.push(laHealth);
  }

  // SF Department of Public Health
  const sfCounty = jurisdictions.find((j) => j.code === 'US-CA-SFC');
  if (sfCounty) {
    const sfHealth = await HealthDept.create({
      jurisdiction_id: sfCounty._id,
      name: 'San Francisco Department of Public Health',
      website: 'https://www.sfdph.org',
      contact: {
        email: 'ehinfo@sfdph.org',
        phone: '+14152526370',
        address: {
          street: '1650 Mission Street',
          city: 'San Francisco',
          state: 'CA',
          zip: '94103',
          country: 'US',
        },
      },
      inspection_portal_url: 'https://www.sfdph.org/dph/EH/Food/default.asp',
      api_available: false,
    });
    healthDepts.push(sfHealth);
  }

  return healthDepts;
}

/**
 * Seed regulatory requirements
 */
async function seedRequirements(jurisdictions: any[]) {
  const requirements = [];

  // LA County Requirements
  const laCounty = jurisdictions.find((j) => j.code === 'US-CA-LAC');
  if (laCounty) {
    // Business License
    requirements.push(
      await RegRequirement.create({
        jurisdiction_id: laCounty._id,
        requirement_type: 'license',
        name: 'Los Angeles County Business License',
        description: 'General business license required for all food establishments in LA County',
        applies_to: {
          kitchen_types: ['shared', 'ghost', 'commissary'],
          business_entity_types: ['sole_proprietorship', 'llc', 'corporation', 'partnership'],
        },
        frequency: 'annual',
        expiration_rules: {
          has_expiration: true,
          validity_period_days: 365,
          renewal_window_days: 30,
        },
        verification_method: 'document_upload',
        priority: 'critical',
        version: '1.0.0',
        source_url: 'http://publichealth.lacounty.gov/eh/misc/ehfees.htm',
      })
    );

    // Health Permit
    requirements.push(
      await RegRequirement.create({
        jurisdiction_id: laCounty._id,
        requirement_type: 'permit',
        name: 'Health Facility Permit',
        description: 'Required health permit for food service facilities in LA County',
        applies_to: {
          kitchen_types: ['shared', 'ghost', 'commissary'],
          business_entity_types: ['sole_proprietorship', 'llc', 'corporation', 'partnership'],
        },
        frequency: 'annual',
        expiration_rules: {
          has_expiration: true,
          validity_period_days: 365,
          renewal_window_days: 60,
        },
        verification_method: 'document_upload',
        priority: 'critical',
        version: '1.0.0',
        source_url: 'http://publichealth.lacounty.gov/eh/docs/food/retail_food.pdf',
      })
    );

    // Food Handler Card
    requirements.push(
      await RegRequirement.create({
        jurisdiction_id: laCounty._id,
        requirement_type: 'certification',
        name: 'Food Handler Card',
        description: 'All food handlers must possess a valid food handler card',
        applies_to: {
          kitchen_types: ['shared', 'ghost', 'commissary'],
          business_entity_types: ['sole_proprietorship', 'llc', 'corporation', 'partnership'],
        },
        frequency: 'biennial',
        expiration_rules: {
          has_expiration: true,
          validity_period_days: 730, // 2 years
          renewal_window_days: 30,
        },
        verification_method: 'document_upload',
        priority: 'high',
        version: '1.0.0',
        source_url: 'http://publichealth.lacounty.gov/eh/food-handler.htm',
      })
    );

    // General Liability Insurance
    requirements.push(
      await RegRequirement.create({
        jurisdiction_id: laCounty._id,
        requirement_type: 'insurance',
        name: 'General Liability Insurance',
        description: 'Minimum $1M general liability insurance coverage',
        applies_to: {
          kitchen_types: ['shared', 'ghost', 'commissary'],
          business_entity_types: ['sole_proprietorship', 'llc', 'corporation', 'partnership'],
        },
        frequency: 'annual',
        expiration_rules: {
          has_expiration: true,
          validity_period_days: 365,
          renewal_window_days: 30,
        },
        verification_method: 'document_upload',
        priority: 'critical',
        version: '1.0.0',
      })
    );
  }

  // SF County Requirements (similar structure)
  const sfCounty = jurisdictions.find((j) => j.code === 'US-CA-SFC');
  if (sfCounty) {
    requirements.push(
      await RegRequirement.create({
        jurisdiction_id: sfCounty._id,
        requirement_type: 'license',
        name: 'San Francisco Business Registration',
        description: 'Business registration certificate required for all food businesses',
        applies_to: {
          kitchen_types: ['shared', 'ghost', 'commissary'],
          business_entity_types: ['sole_proprietorship', 'llc', 'corporation', 'partnership'],
        },
        frequency: 'annual',
        expiration_rules: {
          has_expiration: true,
          validity_period_days: 365,
          renewal_window_days: 30,
        },
        verification_method: 'document_upload',
        priority: 'critical',
        version: '1.0.0',
        source_url: 'https://www.sf.gov/register-your-business',
      })
    );

    requirements.push(
      await RegRequirement.create({
        jurisdiction_id: sfCounty._id,
        requirement_type: 'permit',
        name: 'Health Permit - Food Service',
        description: 'Required health permit from SF Department of Public Health',
        applies_to: {
          kitchen_types: ['shared', 'ghost', 'commissary'],
          business_entity_types: ['sole_proprietorship', 'llc', 'corporation', 'partnership'],
        },
        frequency: 'annual',
        expiration_rules: {
          has_expiration: true,
          validity_period_days: 365,
          renewal_window_days: 60,
        },
        verification_method: 'document_upload',
        priority: 'critical',
        version: '1.0.0',
        source_url: 'https://www.sfdph.org/dph/EH/Food/Permits.asp',
      })
    );

    requirements.push(
      await RegRequirement.create({
        jurisdiction_id: sfCounty._id,
        requirement_type: 'certification',
        name: 'California Food Handler Card',
        description: 'State-issued food handler certification',
        applies_to: {
          kitchen_types: ['shared', 'ghost', 'commissary'],
          business_entity_types: ['sole_proprietorship', 'llc', 'corporation', 'partnership'],
        },
        frequency: 'biennial',
        expiration_rules: {
          has_expiration: true,
          validity_period_days: 1095, // 3 years
          renewal_window_days: 30,
        },
        verification_method: 'document_upload',
        priority: 'high',
        version: '1.0.0',
      })
    );
  }

  return requirements;
}

// Run if called directly
if (require.main === module) {
  seedRegulations();
}

export { seedRegulations };
