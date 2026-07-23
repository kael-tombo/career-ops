#!/usr/bin/env node

/**
 * lib/db/export.mjs — Export SQLite data back to markdown for git tracking
 *
 * Generates:
 *  - data/applications.md (from applications table)
 *  - data/pipeline.md (from pipeline table)
 *
 * Usage:
 *   node lib/db/export.mjs
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { getDb, getAll, close } from './index.mjs';

const ROOT = process.cwd();

function exportApplications() {
  const apps = getAll(`
    SELECT id, date, company, role, score, status,
           pdf_generated, report_path, notes
    FROM applications
    ORDER BY id ASC
  `);

  let md = '# Applications Tracker\n\n';
  md += '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n';
  md += '|---|------|---------|------|-------|--------|-----|--------|-------|\n';

  for (const a of apps) {
    const pdf = a.pdf_generated ? '✅' : '❌';
    const report = a.report_path ? `[${a.id}](${a.report_path})` : '';
    const score = a.score != null ? `${a.score}/5` : '-';
    md += `| ${a.id} | ${a.date} | ${a.company} | ${a.role} | ${score} | ${a.status} | ${pdf} | ${report} | ${a.notes || ''} |\n`;
  }

  const outPath = join(ROOT, 'data/applications.md');
  writeFileSync(outPath, md);
  console.log(`  ✅ Exported ${apps.length} applications → data/applications.md`);
}

function exportPipeline() {
  const items = getAll(`
    SELECT url, company, role, tag, status
    FROM pipeline
    WHERE status = 'pending'
    ORDER BY id ASC
  `);

  let md = '# Pipeline — Pending URLs\n\n';
  for (const item of items) {
    const tag = item.tag ? ` [${item.tag}]` : '';
    md += `- [ ] ${item.url} | ${item.company} | ${item.role}${tag}\n`;
  }

  const outPath = join(ROOT, 'data/pipeline.md');
  writeFileSync(outPath, md);
  console.log(`  ✅ Exported ${items.length} pipeline items → data/pipeline.md`);
}

function main() {
  console.log('\n📤 Career-OPS Database Export\n');
  getDb(); // initialize
  exportApplications();
  exportPipeline();
  close();
  console.log('\n✅ Export complete.\n');
}

main();
