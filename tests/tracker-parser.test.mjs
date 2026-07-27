// tests/tracker-parser.test.mjs — Canonical tracker parser tests
import { pass, fail, finish } from './helpers.mjs';

console.log('\ntracker-parser.mjs — canonical tracker parser');

try {
  const mod = await import('../lib/tracker-parser.mjs');

  // ── parseTracker with inline content ─────────────────────────

  const basicMd = [
    '# Applications Tracker',
    '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|',
    '| 1 | 2026-06-01 | Acme | Eng | 4.5/5 | Applied | ✅ | [1](reports/001-acme.md) | note1 |',
    '| 2 | 2026-06-02 | Beta | Eng | 3.8/5 | Evaluated | ❌ | [2](reports/002-beta.md) | note2 |',
    '| 3 | 2026-06-03 | Gama | Eng | 4.2/5 | Interview | ✅ | ❌ | note3 |',
    '| 4 | 2026-06-04 | Delta | Eng | N/A | Discarded | ❌ | ❌ | no fit |',
  ].join('\n');

  const apps = mod.parseTracker(basicMd);
  const test = (ok, msg, ctx) => ok ? pass(msg) : fail(`${msg} — ${JSON.stringify(ctx)}`);
  test(apps.length === 4, 'parseTracker parses 4 rows with mixed statuses', apps.length);
  if (apps.length < 4) {
    fail('Skipping row-level assertions: not enough rows');
  } else {
    test(apps[0].id === 1 && apps[0].company === 'Acme' && apps[0].score === 4.5 && apps[0].status === 'Applied' && apps[0].pdf === true, 'Row 1: id, company, score, status, pdf correct', apps[0]);
    test(apps[1].id === 2 && apps[1].company === 'Beta' && apps[1].score === 3.8 && apps[1].status === 'Evaluated', 'Row 2: Evaluated row with 3.8 score', apps[1]);
    test(apps[3].score === null, 'Row 4: N/A score becomes null', apps[3]);
  }

  // ── getByStatus ──────────────────────────────────────────────

  const applied = mod.getByStatus('Applied', basicMd);
  if (applied.length === 1 && applied[0].company === 'Acme') pass('getByStatus filters Applied correctly');
  else fail(`getByStatus Applied: ${JSON.stringify(applied)}`);

  // ── getApplicationStats ──────────────────────────────────────

  const stats = mod.getApplicationStats(basicMd);
  if (stats.total === 4 && stats.applied === 1 && stats.interviewed === 1 && stats.scoreAvg === 4.2 && stats.byStatus.Discarded === 1)
    pass('getApplicationStats: totals, status counts, and avg correct');
  else fail(`getApplicationStats: ${JSON.stringify(stats)}`);

  // ── getApplicationsDueForFollowup ────────────────────────────

  const due = mod.getApplicationsDueForFollowup(basicMd, 0);
  if (due.length === 1 && due[0].company === 'Acme') pass('getApplicationsDueForFollowup returns Applied rows');
  else fail(`getApplicationsDueForFollowup: ${JSON.stringify(due)}`);

  // ── Empty / edge cases ──────────────────────────────────────

  const emptyResult = mod.parseTracker('');
  if (emptyResult.length === 0) pass('parseTracker empty string returns []');
  else fail(`Empty input should return [], got ${emptyResult.length}`);

  const noTableMd = [
    '# Applications Tracker',
    '',
    'No applications yet.',
  ].join('\n');
  const noTableResult = mod.parseTracker(noTableMd);
  if (noTableResult.length === 0) pass('parseTracker with no table returns []');
  else fail(`No-table input should return [], got ${noTableResult.length}`);

  // ── CRLF line endings ────────────────────────────────────────

  const crlfMd = [
    '# Applications Tracker',
    '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|',
    '| 1 | 2026-07-01 | TestCo | SE | 4.0/5 | Applied | ✅ | ❌ | crlf test |',
  ].join('\r\n');
  const crlfResult = mod.parseTracker(crlfMd);
  if (crlfResult.length === 1 && crlfResult[0].company === 'TestCo') pass('parseTracker handles CRLF line endings');
  else fail(`CRLF input: ${JSON.stringify(crlfResult)}`);

} catch (e) {
  fail(`tracker-parser tests crashed: ${e.message}`);
}

finish();
