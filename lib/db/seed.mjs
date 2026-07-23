#!/usr/bin/env node

/**
 * lib/db/seed.mjs — Import existing markdown/TSV data into SQLite
 *
 * Reads:
 *  - data/applications.md → applications table
 *  - data/pipeline.md → pipeline table
 *  - data/scan-history.tsv → scan_history table
 *
 * Safe to run multiple times — uses INSERT OR IGNORE / ON CONFLICT.
 *
 * Usage:
 *   node lib/db/seed.mjs
 *   node lib/db/seed.mjs --dry-run   # Preview without writing
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getDb, transaction, close } from './index.mjs';

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');

const stats = { applications: 0, pipeline: 0, scanHistory: 0, errors: [] };

// ═══════════════════════════════════════════════════════════════
// 1. Import applications.md
// ═══════════════════════════════════════════════════════════════
function seedApplications() {
  const file = join(ROOT, 'data/applications.md');
  if (!existsSync(file)) {
    console.log('  ⚠️  data/applications.md not found, skipping');
    return;
  }

  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n')
    .filter(l => l.trim().startsWith('|'))
    .filter(l => !l.includes('---'))
    .filter(l => !l.includes('| # |') && !l.includes('| Date |'));

  const apps = [];
  for (const line of lines) {
    try {
      const cols = line.split('|').map(c => c.trim());
      // Column order in applications.md: | # | Date | Company | Role | Score | Status | PDF | Report | Notes |
      if (cols.length < 8) continue;

      const id = parseInt(cols[1]);
      if (isNaN(id)) continue;

      // Extract URL from report if available
      let url = '';
      const reportMatch = cols[8]?.match(/\(([^)]+)\)/);
      if (reportMatch) {
        const reportPath = join(ROOT, reportMatch[1]);
        try {
          const reportContent = readFileSync(reportPath, 'utf-8');
          const urlMatch = reportContent.match(/\*\*URL:\*\* (.+)/);
          if (urlMatch) url = urlMatch[1].trim();
        } catch { /* report file not found */ }
      }

      apps.push({
        date: cols[2] || new Date().toISOString().split('T')[0],
        company: cols[3] || 'Unknown',
        role: cols[4] || 'Unknown',
        score: parseFloat(cols[5]) || null,
        status: (cols[6] || 'Evaluated').replace(/\*\*/g, '').trim(),
        pdf_generated: cols[7]?.includes('✅') ? 1 : 0,
        report_path: reportMatch ? reportMatch[1] : '',
        notes: cols[9] || '',
        url,
        source: 'seed',
      });
    } catch (err) {
      stats.errors.push(`Application parse error: ${err.message}`);
    }
  }

  if (DRY_RUN) {
    console.log(`  📋 Would import ${apps.length} applications`);
    apps.slice(0, 3).forEach(a => console.log(`     ${a.company} — ${a.role} (${a.score}/5)`));
    return;
  }

  const db = getDb();
  transaction((db) => {
    const stmt = db.prepare(`
      INSERT INTO applications (date, company, role, score, status, pdf_generated, report_path, notes, url, source)
      VALUES (@date, @company, @role, @score, @status, @pdf_generated, @report_path, @notes, @url, @source)
      ON CONFLICT(company, role) DO UPDATE SET
        score = excluded.score,
        status = excluded.status,
        pdf_generated = excluded.pdf_generated,
        report_path = excluded.report_path,
        notes = excluded.notes,
        url = excluded.url,
        updated_at = datetime('now')
    `);
    for (const app of apps) {
      stmt.run(app);
      stats.applications++;
    }
  });

  console.log(`  ✅ Imported ${stats.applications} applications`);
}

// ═══════════════════════════════════════════════════════════════
// 2. Import pipeline.md
// ═══════════════════════════════════════════════════════════════
function seedPipeline() {
  const file = join(ROOT, 'data/pipeline.md');
  if (!existsSync(file)) {
    console.log('  ⚠️  data/pipeline.md not found, skipping');
    return;
  }

  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const items = [];

  for (const line of lines) {
    // Table format: | # | Company | Role | ... |
    if (line.startsWith('|') && !line.includes('---') && !line.includes('| # |')) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 3) {
        const urlMatch = cols[cols.length - 1]?.match(/\(([^)]+)\)/);
        items.push({
          url: urlMatch ? urlMatch[1] : cols[0],
          company: cols[1]?.replace(/\*\*/g, '') || '',
          role: cols[2] || '',
          tag: null,
          source: 'seed',
        });
      }
    }
    // Checklist format: - [ ] url | Company | Title [TAG]
    else {
      const m = line.match(/^- \[ \] (.+?) \| (.+?) \| (.+)$/);
      if (m) {
        const rawTitle = m[3].trim();
        const tagMatch = rawTitle.match(/\[([A-Z-]+)\]/);
        items.push({
          url: m[1].trim(),
          company: m[2].trim(),
          role: rawTitle.replace(/→.*$/, '').replace(/\[[A-Z-]+\]/, '').trim(),
          tag: tagMatch ? tagMatch[1] : null,
          source: 'seed',
        });
      }
    }
  }

  if (DRY_RUN) {
    console.log(`  📋 Would import ${items.length} pipeline items`);
    items.slice(0, 3).forEach(i => console.log(`     ${i.company} — ${i.role}`));
    return;
  }

  const db = getDb();
  transaction((db) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO pipeline (url, company, role, tag, source)
      VALUES (@url, @company, @role, @tag, @source)
    `);
    for (const item of items) {
      const result = stmt.run(item);
      if (result.changes > 0) stats.pipeline++;
    }
  });

  console.log(`  ✅ Imported ${stats.pipeline} pipeline items`);
}

// ═══════════════════════════════════════════════════════════════
// 3. Import scan-history.tsv
// ═══════════════════════════════════════════════════════════════
function seedScanHistory() {
  const file = join(ROOT, 'data/scan-history.tsv');
  if (!existsSync(file)) {
    console.log('  ⚠️  data/scan-history.tsv not found, skipping');
    return;
  }

  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const entries = [];

  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 1) continue;
    entries.push({
      url: (cols[0] || '').split('?')[0],
      scanned_at: cols[1] || new Date().toISOString().split('T')[0],
      portal: cols[2] || '',
      title: cols[3] || '',
      company: cols[4] || '',
      status: cols[5] || 'added',
    });
  }

  if (DRY_RUN) {
    console.log(`  📋 Would import ${entries.length} scan history entries`);
    return;
  }

  const db = getDb();
  transaction((db) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO scan_history (url, scanned_at, portal, title, company, status)
      VALUES (@url, @scanned_at, @portal, @title, @company, @status)
    `);
    for (const entry of entries) {
      const result = stmt.run(entry);
      if (result.changes > 0) stats.scanHistory++;
    }
  });

  console.log(`  ✅ Imported ${stats.scanHistory} scan history entries`);
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════
function main() {
  console.log(`\n🌱 Career-OPS Database Seeder${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  seedApplications();
  seedPipeline();
  seedScanHistory();

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors:`);
    stats.errors.forEach(e => console.log(`   ${e}`));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Applications: ${stats.applications}`);
  console.log(`   Pipeline:     ${stats.pipeline}`);
  console.log(`   Scan History: ${stats.scanHistory}`);
  console.log(`   Errors:       ${stats.errors.length}`);

  close();
  console.log('\n✅ Seed complete.\n');
}

main();
