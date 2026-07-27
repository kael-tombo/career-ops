/**
 * lib/server/routes/metrics.mjs — Prometheus metrics endpoint
 *
 * Exposes /api/metrics in Prometheus exposition format.
 * No external dependencies — collects data from env, DB, and runtime.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('../..', import.meta.url).pathname;
const DATA_DIR = join(ROOT, 'data');
const START_TIME = Date.now();

function countLines(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').length - 1;
  } catch {
    return 0;
  }
}

function escapeLabel(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export default async function metricsRoutes(fastify) {
  fastify.get('/api/metrics', async (request, reply) => {
    reply.header('Content-Type', 'text/plain; charset=utf-8');
    reply.header('Cache-Control', 'no-cache');

    const lines = [];

    // ── Metadata ──────────────────────────────────────────────
    lines.push('# HELP career_ops_info Static metadata about this instance');
    lines.push('# TYPE career_ops_info gauge');
    lines.push(`career_ops_info{version="3.0.0"} 1`);

    // ── Uptime ────────────────────────────────────────────────
    lines.push('# HELP career_ops_uptime_seconds Server uptime in seconds');
    lines.push('# TYPE career_ops_uptime_seconds gauge');
    lines.push(`career_ops_uptime_seconds ${Math.floor((Date.now() - START_TIME) / 1000)}`);

    // ── LLM Providers ─────────────────────────────────────────
    lines.push('# HELP career_ops_llm_provider LLM provider configuration');
    lines.push('# TYPE career_ops_llm_provider gauge');
    const providerKeys = [
      { id: 'openai',   keyVar: 'OPENAI_API_KEY' },
      { id: 'grok',     keyVar: 'XAI_API_KEY' },
      { id: 'kimi',     keyVar: 'KIMI_API_KEY' },
      { id: 'deepseek', keyVar: 'DEEPSEEK_API_KEY' },
      { id: 'gemini',   keyVar: 'GEMINI_API_KEY' },
    ];
    for (const p of providerKeys) {
      const configured = process.env[p.keyVar] || (p.id === 'gemini' && process.env.GEMINI_API_KEYS);
      lines.push(`career_ops_llm_provider{id="${p.id}",configured="${configured ? 'true' : 'false'}"} ${configured ? 1 : 0}`);
    }

    // ── Tracker counts ────────────────────────────────────────
    lines.push('# HELP career_ops_applications_total Total applications tracked');
    lines.push('# TYPE career_ops_applications_total gauge');
    lines.push(`career_ops_applications_total ${countLines(join(DATA_DIR, 'applications.md')) - 6}`);

    lines.push('# HELP career_ops_pipeline_total Total pipeline items');
    lines.push('# TYPE career_ops_pipeline_total gauge');
    lines.push(`career_ops_pipeline_total ${countLines(join(DATA_DIR, 'pipeline.md')) - 5}`);

    // ── Scan totals ───────────────────────────────────────────
    lines.push('# HELP career_ops_scans_total Total portal scan runs');
    lines.push('# TYPE career_ops_scans_total gauge');
    lines.push(`career_ops_scans_total ${countLines(join(DATA_DIR, 'scan-runs.tsv')) - 1}`);

    // ── Reports ────────────────────────────────────────────────
    const reportsDir = join(ROOT, 'reports');
    let reportCount = 0;
    try {
      const { readdirSync } = await import('fs');
      reportCount = readdirSync(reportsDir).filter(f => f.endsWith('.md')).length;
    } catch {}
    lines.push('# HELP career_ops_reports_total Evaluation reports generated');
    lines.push('# TYPE career_ops_reports_total gauge');
    lines.push(`career_ops_reports_total ${reportCount}`);

    // ── Memory usage ──────────────────────────────────────────
    const mem = process.memoryUsage();
    lines.push('# HELP career_ops_memory_bytes Process memory usage');
    lines.push('# TYPE career_ops_memory_bytes gauge');
    lines.push(`career_ops_memory_bytes{type="heap_used"} ${mem.heapUsed}`);
    lines.push(`career_ops_memory_bytes{type="heap_total"} ${mem.heapTotal}`);
    lines.push(`career_ops_memory_bytes{type="rss"} ${mem.rss}`);

    // ── Node info ─────────────────────────────────────────────
    lines.push('# HELP career_ops_node_info Node.js version info');
    lines.push('# TYPE career_ops_node_info gauge');
    lines.push(`career_ops_node_info{version="${escapeLabel(process.version)}",platform="${escapeLabel(process.platform)}"} 1`);

    return lines.join('\n') + '\n';
  });
}
