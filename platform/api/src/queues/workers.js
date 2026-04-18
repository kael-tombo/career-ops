import { Worker } from 'bullmq';
import { redisConnection } from './connection.js';
import { runEvaluation } from '../services/evaluation.js';
import { runScan } from '../services/scanner.js';
import { runPdfGeneration } from '../services/pdf.js';

export async function startWorkers() {
  // ── Evaluation Worker ───────────────────────────────────────────────────────
  const evalWorker = new Worker(
    'evaluations',
    async (job) => {
      console.log(`⚡ Evaluating job ${job.data.jobId} for user ${job.data.userId}`);
      await runEvaluation(job.data);
    },
    { connection: redisConnection, concurrency: 3 }
  );

  evalWorker.on('completed', (job) => console.log(`✅ Evaluation done: ${job.data.jobId}`));
  evalWorker.on('failed', (job, err) => console.error(`❌ Evaluation failed: ${job?.data.jobId}`, err.message));

  // ── Scan Worker ─────────────────────────────────────────────────────────────
  const scanWorker = new Worker(
    'scans',
    async (job) => {
      console.log(`🔍 Scanning portals for user ${job.data.userId}`);
      await runScan(job.data);
    },
    { connection: redisConnection, concurrency: 1 }
  );

  scanWorker.on('completed', (job) => console.log(`✅ Scan done for user: ${job.data.userId}`));
  scanWorker.on('failed', (job, err) => console.error(`❌ Scan failed:`, err.message));

  // ── PDF Worker ──────────────────────────────────────────────────────────────
  const pdfWorker = new Worker(
    'pdfs',
    async (job) => {
      console.log(`📄 Generating PDF for job ${job.data.jobId}`);
      await runPdfGeneration(job.data);
    },
    { connection: redisConnection, concurrency: 2 }
  );

  pdfWorker.on('completed', (job) => console.log(`✅ PDF done: ${job.data.jobId}`));
  pdfWorker.on('failed', (job, err) => console.error(`❌ PDF failed:`, err.message));

  console.log('🔄 BullMQ workers started (eval × 3, scan × 1, pdf × 2)');
}
