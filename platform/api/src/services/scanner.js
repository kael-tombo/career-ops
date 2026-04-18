import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { db } from '../db/client.js';
import { jobs, scanRuns } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Reuse the portals.yml from the parent career-ops repo
const PORTALS_YML = join(__dirname, '../../../../portals.yml');

/**
 * runScan({ userId, scanRunId })
 * Reads portals.yml, checks each portal for new job listings,
 * and inserts newly discovered ones into the jobs table.
 */
export async function runScan({ userId, scanRunId }) {
  let jobsFound = 0;
  let jobsNew = 0;

  try {
    if (!existsSync(PORTALS_YML)) {
      console.warn('⚠️  portals.yml not found, skipping scan');
      await db.update(scanRuns)
        .set({ status: 'done', jobsFound: 0, jobsNew: 0, completedAt: new Date(), error: 'portals.yml not found' })
        .where(eq(scanRuns.id, scanRunId));
      return;
    }

    const portalsRaw = readFileSync(PORTALS_YML, 'utf-8');
    const portals = yaml.load(portalsRaw);

    const entries = Array.isArray(portals)
      ? portals
      : portals?.portals ?? portals?.companies ?? Object.values(portals).flat();

    for (const portal of entries) {
      const company = portal.company || portal.name || 'Unknown';
      const source = portal.source || portal.ats || 'manual';
      const roles = Array.isArray(portal.roles) ? portal.roles : [];

      for (const role of roles) {
        const roleTitle = typeof role === 'string' ? role : role.title || role.role || String(role);
        const url = typeof role === 'object' && role.url ? role.url : null;

        jobsFound++;

        // Check if this job already exists for this user (dedup by company + role)
        const [existing] = await db.select()
          .from(jobs)
          .where(and(
            eq(jobs.userId, userId),
            eq(jobs.company, company),
            eq(jobs.role, roleTitle)
          ));

        if (!existing) {
          await db.insert(jobs).values({
            userId,
            company,
            role: roleTitle,
            url,
            source,
            status: 'Inbox',
          });
          jobsNew++;
          console.log(`  ✨ New job: ${company} — ${roleTitle}`);
        }
      }
    }

    await db.update(scanRuns)
      .set({ status: 'done', jobsFound, jobsNew, completedAt: new Date() })
      .where(eq(scanRuns.id, scanRunId));

    console.log(`✅ Scan complete: ${jobsFound} found, ${jobsNew} new`);
  } catch (err) {
    console.error('❌ Scan error:', err.message);
    await db.update(scanRuns)
      .set({ status: 'error', error: err.message, completedAt: new Date() })
      .where(eq(scanRuns.id, scanRunId));
    throw err;
  }
}
