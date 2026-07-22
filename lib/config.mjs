#!/usr/bin/env node
/**
 * lib/config.mjs — Configuration validation and defaults
 *
 * Loads config/profile.yml and validates its schema.
 * Provides defaults for missing optional fields.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

/**
 * Schema definition for config/profile.yml
 */
const SCHEMA = {
  candidate: {
    required: ['full_name', 'email'],
    optional: ['phone', 'location', 'linkedin', 'github', 'portfolio_url', 'canva_resume_design_id'],
  },
  target_roles: {
    required: [],
    optional: ['primary', 'archetypes'],
  },
  narrative: {
    required: [],
    optional: ['headline', 'exit_story', 'superpowers', 'proof_points'],
  },
  compensation: {
    required: [],
    optional: ['target_range', 'currency', 'minimum', 'location_flexibility', 'notes'],
  },
  location: {
    required: [],
    optional: ['country', 'city', 'timezone', 'visa_status', 'remote_preference'],
  },
  language: {
    required: [],
    optional: ['modes_dir', 'output_language', 'notes'],
  },
};

/**
 * Default values for missing fields
 */
const DEFAULTS = {
  target_roles: {
    primary: ['Software Engineer'],
    archetypes: [],
  },
  narrative: {
    headline: '',
    superpowers: [],
    proof_points: [],
  },
  compensation: {
    currency: 'USD',
    location_flexibility: 'Remote preferred',
  },
  location: {
    timezone: 'UTC',
    remote_preference: 'Remote preferred',
  },
  language: {
    modes_dir: 'modes',
    output_language: 'en',
  },
};

/**
 * Validate profile against schema.
 * @param {object} profile - Loaded profile
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export function validateProfile(profile) {
  const errors = [];

  for (const [section, rules] of Object.entries(SCHEMA)) {
    if (!(section in profile)) {
      if (rules.required.length > 0) {
        errors.push(`Missing required section: ${section}`);
      }
      continue;
    }

    const sectionData = profile[section];
    if (typeof sectionData !== 'object' || sectionData == null) {
      errors.push(`Section ${section} should be an object`);
      continue;
    }

    // Check required fields
    for (const field of rules.required) {
      if (!(field in sectionData) || sectionData[field] == null) {
        errors.push(`Missing required field: ${section}.${field}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Load profile with validation and defaults.
 * @param {string} rootPath - Project root directory
 * @returns {object} Validated profile with defaults applied
 */
export function loadConfig(rootPath) {
  const profilePath = join(rootPath, 'config/profile.yml');

  if (!existsSync(profilePath)) {
    throw new Error(
      `Profile not found: ${profilePath}\n` +
      `Run "node career-ops.mjs" to set up the system.`
    );
  }

  let profile;
  try {
    profile = yaml.load(readFileSync(profilePath, 'utf-8'));
  } catch (err) {
    throw new Error(`Failed to parse config/profile.yml: ${err.message}`);
  }

  // Validate
  const validation = validateProfile(profile);
  if (!validation.valid) {
    console.warn('⚠️  Profile validation warnings:');
    validation.errors.forEach(err => console.warn(`   - ${err}`));
  }

  // Apply defaults for missing sections
  for (const [section, defaults] of Object.entries(DEFAULTS)) {
    if (!profile[section]) {
      profile[section] = { ...defaults };
    } else {
      for (const [key, value] of Object.entries(defaults)) {
        if (!(key in profile[section])) {
          profile[section][key] = value;
        }
      }
    }
  }

  // Ensure candidate has all optional fields
  const candidateDefaults = {
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    portfolio_url: '',
  };
  for (const [key, value] of Object.entries(candidateDefaults)) {
    if (!profile.candidate[key]) {
      profile.candidate[key] = value;
    }
  }

  return profile;
}

/**
 * Get candidate display name (first + last).
 */
export function getDisplayName(profile) {
  const parts = (profile.candidate.full_name || '').split(' ');
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || parts[0] || '',
    fullName: profile.candidate.full_name || '',
  };
}

/**
 * Check if system is set up.
 */
export function checkSetup(rootPath) {
  const checks = {
    cv: existsSync(join(rootPath, 'cv.md')),
    profile: existsSync(join(rootPath, 'config/profile.yml')),
    profileMode: existsSync(join(rootPath, 'modes/_profile.md')),
    portals: existsSync(join(rootPath, 'portals.yml')),
    tracker: existsSync(join(rootPath, 'data/applications.md')),
  };

  return {
    complete: Object.values(checks).every(v => v),
    checks,
    missing: Object.entries(checks)
      .filter(([, v]) => !v)
      .map(([k]) => k),
  };
}
