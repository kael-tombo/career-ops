import { readFileSync, existsSync } from 'fs';
import yaml from 'js-yaml';
import { db } from '../db/client.js';
import { jobs, scanRuns, profiles } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

/**
 * runScan({ userId, scanRunId })
 * Reads portals.yml, checks each portal for new job listings,
 * and inserts newly discovered ones into the jobs table.
 */
export async function runScan({ userId, scanRunId }) {
  let jobsFound = 0;
  let jobsNew = 0;

  try {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    
    if (!profile || !profile.portalsConfig) {
      console.warn(`⚠️  No portalsConfig found for user ${userId}, skipping scan`);
      await db.update(scanRuns)
        .set({ status: 'done', jobsFound: 0, jobsNew: 0, completedAt: new Date(), error: 'No portals configured' })
        .where(eq(scanRuns.id, scanRunId));
      return;
    }

    const portalsRaw = profile.portalsConfig;
    const portals = yaml.load(portalsRaw) || {};

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
