import { pgTable, text, integer, decimal, boolean, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';

// Users — synced from Clerk webhooks
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  stripeCustomerId: text('stripe_customer_id'),
  plan: text('plan').notNull().default('free'), // free | pro | elite
  evalCount: integer('eval_count').notNull().default(0),
  evalResetAt: timestamp('eval_reset_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User profile (target roles, comp, narrative)
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fullName: text('full_name'),
  location: text('location'),
  timezone: text('timezone'),
  cvMarkdown: text('cv_markdown'),           // cv.md content
  articleDigest: text('article_digest'),     // article-digest.md
  targetRoles: jsonb('target_roles'),        // array of roles
  compensationTarget: text('compensation_target'),
  narrative: jsonb('narrative'),             // headline, superpowers, proof_points
  portalsConfig: text('portals_config'),     // portals.yml content (user-specific)
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Jobs — discovered by scanner or added manually
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  company: text('company').notNull(),
  role: text('role').notNull(),
  url: text('url'),
  source: text('source'),                    // greenhouse | ashby | lever | manual
  status: text('status').notNull().default('Inbox'), // Inbox | Evaluated | Applied | Interview | Offer | Rejected | Discarded | SKIP
  score: decimal('score', { precision: 3, scale: 1 }),
  pdfGenerated: boolean('pdf_generated').default(false),
  reportId: uuid('report_id'),
  notes: text('notes'),
  discoveredAt: timestamp('discovered_at').defaultNow(),
  appliedAt: timestamp('applied_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Evaluation reports — AI output per job
export const evaluations = pgTable('evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  score: decimal('score', { precision: 3, scale: 1 }),
  archetype: text('archetype'),
  legitimacy: text('legitimacy'),
  blockA: text('block_a'),                   // Role Summary
  blockB: text('block_b'),                   // CV Match
  blockC: text('block_c'),                   // Level Strategy
  blockD: text('block_d'),                   // Comp Research
  blockE: text('block_e'),                   // Personalization
  blockF: text('block_f'),                   // Interview Prep / STAR
  blockG: text('block_g'),                   // Posting Legitimacy
  rawMarkdown: text('raw_markdown'),         // Full report markdown
  model: text('model').default('claude-opus-4-5'),
  tokens: integer('tokens'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Generated CVs / PDFs
export const cvAssets = pgTable('cv_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  storageUrl: text('storage_url'),           // URL to stored PDF (future: S3/R2)
  localPath: text('local_path'),             // For self-hosted
  createdAt: timestamp('created_at').defaultNow(),
});

// Interview prep reports
export const interviewPrep = pgTable('interview_prep', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  company: text('company').notNull(),
  role: text('role').notNull(),
  content: text('content'),                  // Full prep markdown
  starStories: jsonb('star_stories'),        // Parsed STAR stories array
  createdAt: timestamp('created_at').defaultNow(),
});

// Scan runs — history/dedup
export const scanRuns = pgTable('scan_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').default('running'),  // running | done | error
  jobsFound: integer('jobs_found').default(0),
  jobsNew: integer('jobs_new').default(0),
  error: text('error'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Portfolios — public shareable evidence pages
export const portfolios = pgTable('portfolios', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  cvContent: text('cv_content'),
  starStories: jsonb('star_stories'),
  theme: text('theme').default('dark'),
  isPublic: boolean('is_public').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});
