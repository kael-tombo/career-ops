#!/usr/bin/env node
/**
 * analyze-patterns.mjs — Rejection & Application Pattern Analysis
 *
 * Analyzes data/applications.md to extract actionable insights:
 *   1. Rejection patterns by company, role type, region, archetype
 *   2. Success patterns — what scores/roles/companies convert
 *   3. Response rate by source/platform
 *   4. Time-to-response analysis
 *   5. Recommended targeting adjustments
 *
 * Usage:
 *   node analyze-patterns.mjs               # Full analysis (JSON stdout)
 *   node analyze-patterns.mjs --summary     # Human-readable summary
 *   node analyze-patterns.mjs --json        # Machine-readable JSON
 *   node analyze-patterns.mjs --save        # Save to output/patterns.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const ROOT = process.cwd();
const APPS_FILE = join(ROOT, 'data/applications.md');
const PROFILE_FILE = join(ROOT, 'config/profile.yml');

// ─── Parser ───

function parseTracker(md) {
  const lines = md.split('\n');
  const headerIndex = lines.findIndex(l => l.includes('| Date | Company | Role |'));
  if (headerIndex < 0) return [];

  const entries = [];
  for (let i = headerIndex + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || line.includes('---')) continue;
    const cols = line.split('|').slice(1, -1).map(c => c.trim());
    if (cols.length < 7) continue;

    const entry = {
      num: parseInt(cols[0]) || 0,
      date: cols[1] || '',
      company: cols[2] || '',
      role: cols[3] || '',
      status: cols[4] || '',
      score: parseFloat(cols[5]) || 0,
      pdf: cols[6]?.includes('✅'),
      report: cols[7] || '',
      notes: cols[8] || '',
    };
    entries.push(entry);
  }
  return entries;
}

// ─── Analysis ───

function analyze(entries) {
  const total = entries.length;
  const byStatus = {};
  const byCompany = {};
  const rejectionReasons = {};
  const scoreByStatus = {};
  const monthlyTrends = {};

  for (const e of entries) {
    // Status counts
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;

    // Per-company stats
    if (!byCompany[e.company]) byCompany[e.company] = { total: 0, applied: 0, rejected: 0, interview: 0, offer: 0, scores: [] };
    byCompany[e.company].total++;
    byCompany[e.company].scores.push(e.score);
    if (e.status === 'Applied') byCompany[e.company].applied++;
    if (e.status === 'Rejected') byCompany[e.company].rejected++;
    if (e.status === 'Interview') byCompany[e.company].interview++;
    if (e.status === 'Offer') byCompany[e.company].offer++;

    // Rejection reasons
    if (e.status === 'Rejected' && e.notes) {
      const lower = e.notes.toLowerCase();
      if (lower.includes('visa')) rejectionReasons.visa = (rejectionReasons.visa || 0) + 1;
      if (lower.includes('experience') || lower.includes('seniority')) rejectionReasons.experience = (rejectionReasons.experience || 0) + 1;
      if (lower.includes('location')) rejectionReasons.location = (rejectionReasons.location || 0) + 1;
      if (lower.includes('skill') || lower.includes('tech stack')) rejectionReasons.skills = (rejectionReasons.skills || 0) + 1;
      if (lower.includes('salary') || lower.includes('comp')) rejectionReasons.salary = (rejectionReasons.salary || 0) + 1;
      if (lower.includes('hiring freeze') || lower.includes('filled')) rejectionReasons.filled = (rejectionReasons.filled || 0) + 1;
    }

    // Score per status
    if (!scoreByStatus[e.status]) scoreByStatus[e.status] = { sum: 0, count: 0 };
    scoreByStatus[e.status].sum += e.score;
    scoreByStatus[e.status].count++;

    // Monthly trends
    const month = e.date?.substring(0, 7);
    if (month) {
      if (!monthlyTrends[month]) monthlyTrends[month] = { total: 0, applied: 0, rejected: 0, interview: 0 };
      monthlyTrends[month].total++;
      if (e.status === 'Applied') monthlyTrends[month].applied++;
      if (e.status === 'Rejected') monthlyTrends[month].rejected++;
      if (e.status === 'Interview') monthlyTrends[month].interview++;
    }
  }

  // Conversion rates
  const applied = byStatus['Applied'] || 0;
  const responded = byStatus['Responded'] || 0;
  const interviewed = byStatus['Interview'] || 0;
  const offers = byStatus['Offer'] || 0;
  const rejected = byStatus['Rejected'] || 0;

  return {
    total,
    byStatus,
    conversion: {
      applicationToResponse: total > 0 ? ((responded / total) * 100).toFixed(1) + '%' : '0%',
      applicationToInterview: total > 0 ? ((interviewed / total) * 100).toFixed(1) + '%' : '0%',
      applicationToOffer: total > 0 ? ((offers / total) * 100).toFixed(1) + '%' : '0%',
      interviewToOffer: interviewed > 0 ? ((offers / interviewed) * 100).toFixed(1) + '%' : '0%',
    },
    avgScoreByStatus: Object.fromEntries(
      Object.entries(scoreByStatus).map(([k, v]) => [k, (v.sum / v.count).toFixed(2)])
    ),
    rejectionBreakdown: rejectionReasons,
    topCompanies: Object.entries(byCompany)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15)
      .map(([name, stats]) => ({
        name,
        total: stats.total,
        applied: stats.applied,
        rejected: stats.rejected,
        interview: stats.interview,
        offer: stats.offer,
        avgScore: (stats.scores.reduce((s, x) => s + x, 0) / stats.scores.length).toFixed(2),
      })),
    monthlyTrends: Object.entries(monthlyTrends)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({ month, ...data })),
    recommendations: generateRecommendations(byStatus, rejectionReasons, total),
  };
}

function generateRecommendations(byStatus, rejections, total) {
  const recs = [];
  const applied = byStatus['Applied'] || 0;
  const interviewed = byStatus['Interview'] || 0;
  const rejected = byStatus['Rejected'] || 0;

  if (applied > 10 && interviewed === 0) {
    recs.push('CRITICAL: Zero interviews from applications. Review CV targeting and archetype alignment.');
  }
  if (rejections.visa > 2) {
    recs.push('Visa sponsorship is a major rejection driver. Prioritize companies that explicitly sponsor.');
  }
  if (rejections.skills > 2) {
    recs.push('Skill mismatches are blocking applications. Adjust archetypes to match actual JD requirements.');
  }
  if (rejections.location > 2) {
    recs.push('Location constraints causing rejections. Focus on remote-first companies or adjust location preferences.');
  }
  if (rejections.experience > 2) {
    recs.push('Seniority gap detected. Consider targeting roles 1 level below current or emphasizing transferable experience.');
  }
  if (total > 20 && (applied / total) < 0.3) {
    recs.push('Low application rate. Increase apply volume or improve pipeline filtering to find better matches.');
  }
  if (!recs.length) {
    recs.push('No significant patterns detected. Continue current strategy.');
  }
  return recs;
}

function printSummary(result) {
  console.log(`\n📊 Pattern Analysis Report`);
  console.log(`   Total entries: ${result.total}`);
  console.log(`\n📈 Conversion Funnel:`);
  for (const [k, v] of Object.entries(result.conversion)) {
    console.log(`   ${k}: ${v}`);
  }
  console.log(`\n📋 Status Breakdown:`);
  for (const [k, v] of Object.entries(result.byStatus).sort((a, b) => b[1] - a[1])) {
    const pct = ((v / result.total) * 100).toFixed(1);
    const avg = result.avgScoreByStatus[k] || '-';
    console.log(`   ${k.padEnd(15)} ${v.toString().padStart(3)} (${pct}%) avg score: ${avg}`);
  }
  if (Object.keys(result.rejectionBreakdown).length > 0) {
    console.log(`\n❌ Rejection Reasons:`);
    for (const [k, v] of Object.entries(result.rejectionBreakdown).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${k}: ${v}`);
    }
  }
  console.log(`\n🏆 Top Companies:`);
  for (const c of result.topCompanies.slice(0, 5)) {
    console.log(`   ${c.name}: ${c.total} apps, ${c.interview} interviews, avg ${c.avgScore}`);
  }
  console.log(`\n💡 Recommendations:`);
  for (const r of result.recommendations) {
    console.log(`   • ${r}`);
  }
  console.log();
}

async function main() {
  const args = process.argv.slice(2);
  const showSummary = args.includes('--summary');
  const showJson = args.includes('--json') || !showSummary;
  const saveOutput = args.includes('--save');

  if (!existsSync(APPS_FILE)) {
    console.error('data/applications.md not found');
    process.exit(1);
  }

  const md = readFileSync(APPS_FILE, 'utf-8');
  const entries = parseTracker(md);
  const result = analyze(entries);

  if (showSummary) printSummary(result);
  if (showJson) console.log(JSON.stringify(result, null, 2));
  if (saveOutput) {
    mkdirSync(join(ROOT, 'output'), { recursive: true });
    writeFileSync(join(ROOT, 'output/patterns.json'), JSON.stringify(result, null, 2));
    console.log(`\n✅ Saved to output/patterns.json`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
