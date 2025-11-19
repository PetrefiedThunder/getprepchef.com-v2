/**
 * Expanded Jurisdictions Seed Script
 * Adds New York and Texas regulatory data
 */

import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../connection';
import { Jurisdiction } from '../../modules/regintel/jurisdiction.model';
import { HealthDept } from '../../modules/regintel/health_dept.model';
import { RegRequirement } from '../../modules/regintel/reg_requirement.model';
import { logger } from '../../config/logger';

async function seedExpandedJurisdictions() {
  logger.info('Starting expanded jurisdictions seed...');

  try {
    await connectDatabase();

    // Get US country
    const us = await Jurisdiction.findOne({ code: 'US', type: 'country' });
    if (!us) {
      throw new Error('US country not found. Run seed_regulations.ts first.');
    }

    // =========================================================================
    // NEW YORK STATE
    // =========================================================================
    logger.info('Creating New York jurisdictions...');

    const newYork = await Jurisdiction.create({
      type: 'state',
      name: 'New York',
      code: 'US-NY',
      parent_id: us._id,
      metadata: {
        population: 19_850_000,
        timezone: 'America/New_York',
        regulatory_complexity_score: 9,
        coverage_status: 'full',
      },
    });

    // NYC Counties
    const nycCounties = [
      {
        name: 'New York County (Manhattan)',
        code: 'US-NY-NEW',
        population: 1_630_000,
      },
      {
        name: 'Kings County (Brooklyn)',
        code: 'US-NY-KIN',
        population: 2_560_000,
      },
      {
        name: 'Queens County',
        code: 'US-NY-QUE',
        population: 2_280_000,
      },
    ];

    const createdNYCounties: any[] = [];
    for (const countyData of nycCounties) {
      const county = await Jurisdiction.create({
        type: 'county',
        name: countyData.name,
        code: countyData.code,
        parent_id: newYork._id,
        metadata: {
          population: countyData.population,
          timezone: 'America/New_York',
          regulatory_complexity_score: 9,
          coverage_status: 'full',
        },
      });
      createdNYCounties.push(county);
    }

    // =========================================================================
    // NEW YORK HEALTH DEPARTMENTS
    // =========================================================================
    logger.info('Creating New York health departments...');

    const nycDohmh = await HealthDept.create({
      jurisdiction_id: createdNYCounties[0]._id, // Manhattan
      name: 'New York City Department of Health and Mental Hygiene',
      website_url: 'https://www1.nyc.gov/site/doh/index.page',
      phone: '311',
      email: 'healthinfo@health.nyc.gov',
      address: {
        street: '42-09 28th Street',
        city: 'Long Island City',
        state: 'NY',
        zip: '11101',
        country: 'US',
      },
    });

    // =========================================================================
    // NEW YORK REGULATORY REQUIREMENTS
    // =========================================================================
    logger.info('Creating New York regulatory requirements...');

    const nyRequirements = [
      {
        jurisdiction_id: newYork._id,
        requirement_type: 'mobile_food_vendor_license',
        name: 'Mobile Food Vendor License',
        description: 'Required for all food vendors operating in NYC',
        applies_to: {
          kitchen_types: ['shared', 'ghost', 'commissary'],
          entity_types: ['sole_proprietorship', 'llc', 'corporation', 'partnership'],
        },
        frequency: 'biannual' as const,
        expiration_rules: {
          has_expiration: true,
          validity_months: 24,
        },
        priority: 1,
        version: '1.0.0',
        effective_from: new Date('2020-01-01'),
        source_url: 'https://www1.nyc.gov/site/doh/services/mobile-food-vendors.page',
      },
      {
        jurisdiction_id: newYork._id,
        requirement_type: 'food_protection_certificate',
        name: 'Food Protection Certificate',
        description: 'NYC Food Protection Course certification for food handlers',
        applies_to: {
          kitchen_types: ['shared', 'ghost', 'commissary'],
          entity_types: ['sole_proprietorship', 'llc', 'corporation', 'partnership'],
        },
        frequency: 'once' as const,
        expiration_rules: {
          has_expiration: true,
          validity_months: 60,
        },
        priority: 2,
        version: '1.0.0',
        effective_from: new Date('2018-01-01'),
        source_url: 'https://www1.nyc.gov/site/doh/business/food-operators/food-protection-course.page',
      },
      {
        jurisdiction_id: createdNYCounties[0]._id, // Manhattan
        requirement_type: 'permit_to_operate',
        name: 'NYC Food Service Establishment Permit',
        description: 'Required permit to operate food service establishment',
        applies_to: {
          kitchen_types: ['shared', 'commissary'],
          entity_types: ['llc', 'corporation'],
        },
        frequency: 'annual' as const,
        expiration_rules: {
          has_expiration: true,
          validity_months: 12,
        },
        priority: 1,
        version: '1.0.0',
        effective_from: new Date('2020-01-01'),
        source_url: 'https://www1.nyc.gov/site/doh/services/restaurant-grades.page',
      },
      {
        jurisdiction_id: newYork._id,
        requirement_type: 'general_liability_insurance',
        name: 'General Liability Insurance',
        description: '$1M minimum coverage required',
        applies_to: {
          kitchen_types: ['shared', 'ghost', 'commissary'],
          entity_types: ['llc', 'corporation', 'partnership'],
        },
        frequency: 'annual' as const,
        expiration_rules: {
          has_expiration: true,
          validity_months: 12,
        },
        priority: 3,
        version: '1.0.0',
        effective_from: new Date('2019-01-01'),
        source_url: 'https://www.ny.gov/services/business-insurance-requirements',
      },
    ];

    await RegRequirement.create(nyRequirements);

    // =========================================================================
    // TEXAS STATE
    // =========================================================================
    logger.info('Creating Texas jurisdictions...');

    const texas = await Jurisdiction.create({
      type: 'state',
      name: 'Texas',
      code: 'US-TX',
      parent_id: us._id,
      metadata: {
        population: 29_530_000,
        timezone: 'America/Chicago',
        regulatory_complexity_score: 7,
        coverage_status: 'full',
      },
    });

    // Texas Counties
    const texasCounties = [
      {
        name: 'Harris County',
        code: 'US-TX-HAR',
        population: 4_730_000,
        city: 'Houston',
      },
      {
        name: 'Travis County',
        code: 'US-TX-TRA',
        population: 1_290_000,
        city: 'Austin',
      },
      {
        name: 'Dallas County',
        code: 'US-TX-DAL',
        population: 2_640_000,
        city: 'Dallas',
      },
    ];

    const createdTXCounties: any[] = [];
    for (const countyData of texasCounties) {
      const county = await Jurisdiction.create({
        type: 'county',
        name: countyData.name,
        code: countyData.code,
        parent_id: texas._id,
        metadata: {
          population: countyData.population,
          timezone: 'America/Chicago',
          regulatory_complexity_score: 7,
          coverage_status: 'full',
        },
      });
      createdTXCounties.push(county);
    }

    // =========================================================================
    // TEXAS HEALTH DEPARTMENTS
    // =========================================================================
    logger.info('Creating Texas health departments...');

    const harrisPH = await HealthDept.create({
      jurisdiction_id: createdTXCounties[0]._id, // Harris County
      name: 'Harris County Public Health',
      website_url: 'https://publichealth.harriscountytx.gov/',
      phone: '(713) 439-6000',
      email: 'hcph@hcph-tx.org',
      address: {
        street: '2223 West Loop South',
        city: 'Houston',
        state: 'TX',
        zip: '77027',
        country: 'US',
      },
    });

    const travisAPH = await HealthDept.create({
      jurisdiction_id: createdTXCounties[1]._id, // Travis County
      name: 'Austin Public Health',
      website_url: 'http://www.austintexas.gov/department/health',
      phone: '(512) 978-8000',
      email: 'health@austintexas.gov',
      address: {
        street: '15 Waller Street',
        city: 'Austin',
        state: 'TX',
        zip: '78702',
        country: 'US',
      },
    });

    // =========================================================================
    // TEXAS REGULATORY REQUIREMENTS
    // =========================================================================
    logger.info('Creating Texas regulatory requirements...');

    const txRequirements = [
      {
        jurisdiction_id: texas._id,
        requirement_type: 'food_managers_certificate',
        name: 'Texas Food Manager Certification',
        description: 'Required for at least one employee per establishment',
        applies_to: {
          kitchen_types: ['shared', 'ghost', 'commissary'],
          entity_types: ['sole_proprietorship', 'llc', 'corporation', 'partnership'],
        },
        frequency: 'once' as const,
        expiration_rules: {
          has_expiration: true,
          validity_months: 60,
        },
        priority: 1,
        version: '1.0.0',
        effective_from: new Date('2015-01-01'),
        source_url: 'https://www.dshs.texas.gov/food-manager-certification',
      },
      {
        jurisdiction_id: texas._id,
        requirement_type: 'food_handlers_card',
        name: 'Texas Food Handler Card',
        description: 'Required for all food handlers within 60 days of hire',
        applies_to: {
          kitchen_types: ['shared', 'ghost', 'commissary'],
          entity_types: ['sole_proprietorship', 'llc', 'corporation', 'partnership'],
        },
        frequency: 'once' as const,
        expiration_rules: {
          has_expiration: true,
          validity_months: 24,
        },
        priority: 2,
        version: '1.0.0',
        effective_from: new Date('2014-01-01'),
        source_url: 'https://www.dshs.texas.gov/food-handler',
      },
      {
        jurisdiction_id: createdTXCounties[0]._id, // Harris County
        requirement_type: 'food_service_permit',
        name: 'Harris County Food Service Permit',
        description: 'Health permit for food service establishments',
        applies_to: {
          kitchen_types: ['shared', 'commissary'],
          entity_types: ['llc', 'corporation'],
        },
        frequency: 'annual' as const,
        expiration_rules: {
          has_expiration: true,
          validity_months: 12,
        },
        priority: 1,
        version: '1.0.0',
        effective_from: new Date('2020-01-01'),
        source_url: 'https://publichealth.harriscountytx.gov/Services-Programs/Services/Food',
      },
      {
        jurisdiction_id: createdTXCounties[1]._id, // Travis County
        requirement_type: 'mobile_food_establishment_permit',
        name: 'Austin Mobile Food Establishment Permit',
        description: 'Required for mobile food vendors in Austin',
        applies_to: {
          kitchen_types: ['shared', 'ghost'],
          entity_types: ['sole_proprietorship', 'llc', 'corporation'],
        },
        frequency: 'annual' as const,
        expiration_rules: {
          has_expiration: true,
          validity_months: 12,
        },
        priority: 1,
        version: '1.0.0',
        effective_from: new Date('2019-01-01'),
        source_url: 'http://www.austintexas.gov/department/food-establishment-licensing',
      },
      {
        jurisdiction_id: texas._id,
        requirement_type: 'general_liability_insurance',
        name: 'General Liability Insurance',
        description: '$500K minimum coverage required',
        applies_to: {
          kitchen_types: ['shared', 'ghost', 'commissary'],
          entity_types: ['llc', 'corporation', 'partnership'],
        },
        frequency: 'annual' as const,
        expiration_rules: {
          has_expiration: true,
          validity_months: 12,
        },
        priority: 3,
        version: '1.0.0',
        effective_from: new Date('2018-01-01'),
        source_url: 'https://www.tdi.texas.gov/',
      },
      {
        jurisdiction_id: texas._id,
        requirement_type: 'sales_tax_permit',
        name: 'Texas Sales Tax Permit',
        description: 'Required for all businesses selling taxable items',
        applies_to: {
          kitchen_types: ['shared', 'ghost', 'commissary'],
          entity_types: ['sole_proprietorship', 'llc', 'corporation', 'partnership'],
        },
        frequency: 'once' as const,
        expiration_rules: {
          has_expiration: false,
        },
        priority: 4,
        version: '1.0.0',
        effective_from: new Date('2010-01-01'),
        source_url: 'https://comptroller.texas.gov/taxes/sales/',
      },
    ];

    await RegRequirement.create(txRequirements);

    // =========================================================================
    // SUMMARY
    // =========================================================================
    const jurisdictionCount = await Jurisdiction.countDocuments();
    const healthDeptCount = await HealthDept.countDocuments();
    const requirementCount = await RegRequirement.countDocuments();

    logger.info('✅ Expanded jurisdictions seed completed successfully!');
    logger.info(`Total Jurisdictions: ${jurisdictionCount}`);
    logger.info(`Total Health Departments: ${healthDeptCount}`);
    logger.info(`Total Requirements: ${requirementCount}`);
    logger.info('');
    logger.info('Coverage:');
    logger.info('  - California (LA County, SF County)');
    logger.info('  - New York (Manhattan, Brooklyn, Queens)');
    logger.info('  - Texas (Harris County, Travis County, Dallas County)');
    logger.info('');
    logger.info('🎉 PrepChef now covers 3 states with 9 major markets!');

  } catch (error) {
    logger.error('Error seeding expanded jurisdictions:', error);
    throw error;
  } finally {
    await disconnectDatabase();
  }
}

// Run if called directly
if (require.main === module) {
  seedExpandedJurisdictions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedExpandedJurisdictions };
