import { Worker } from 'bullmq';
import { redisConnection } from './connection.js';
import { runEvaluation } from '../services/evaluation.js';
import { runScan } from '../services/scanner.js';
import { runPdfGeneration } from '../services/pdf.js';
import { checkLiveness } from '../services/liveness.js';

export async function startWorkers(io) {
  // ── Evaluation Worker ───────────────────────────────────────────────────────
  const evalWorker = new Worker(
    'evaluations',
    async (job) => {
      console.log(`⚡ Evaluating job ${job.data.jobId} for user ${job.data.userId}`);
      await runEvaluation(job.data);
    },
    { connection: redisConnection, concurrency: 3 }
  );

  evalWorker.on('completed', (job) => {
    console.log(`✅ Evaluation done: ${job.data.jobId}`);
    io?.to(job.data.userId).emit('notification', {
      type: 'EVALUATION_COMPLETE',
      message: `Evaluation finished for ${job.data.company || 'job'}`,
      jobId: job.data.jobId
    });
  });
  evalWorker.on('failed', (job, err) => console.error(`❌ Evaluation failed: ${job?.data.jobId}`, err.message));

  // ── Scan Worker ─────────────────────────────────────────────────────────────
  const scanWorker = new Worker(
    'scans',
    async (job) => {
      console.log(`🔍 Scanning portals for user ${job.data.userId}`);
      await runScan({ ...job.data, io });
    },
    { connection: redisConnection, concurrency: 1 }
  );

  scanWorker.on('completed', (job) => {
    console.log(`✅ Scan done for user: ${job.data.userId}`);
    io?.to(job.data.userId).emit('notification', {
      type: 'SCAN_COMPLETE',
      message: `Portal scan finished! New jobs found.`
    });
  });
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

  pdfWorker.on('completed', (job) => {
    console.log(`✅ PDF done: ${job.data.jobId}`);
    io?.to(job.data.userId).emit('notification', {
      type: 'PDF_READY',
      message: `CV PDF is ready for download.`,
      jobId: job.data.jobId
    });
  });
  pdfWorker.on('failed', (job, err) => console.error(`❌ PDF failed:`, err.message));

  // ── Liveness Worker ─────────────────────────────────────────────────────────
  const livenessWorker = new Worker(
    'liveness',
    async (job) => {
      console.log(`🔍 Checking liveness for job ${job.data.jobId}`);
      await checkLiveness(job.data);
    },
    { connection: redisConnection, concurrency: 2 }
  );

  livenessWorker.on('completed', (job) => {
    console.log(`✅ Liveness check done: ${job.data.jobId}`);
  });
  livenessWorker.on('failed', (job, err) => console.error(`❌ Liveness failed:`, err.message));

  console.log('🔄 BullMQ workers started (eval × 3, scan × 1, pdf × 2, liveness × 2)');
}
