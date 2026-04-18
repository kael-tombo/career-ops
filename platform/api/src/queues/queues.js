import { Queue } from 'bullmq';
import { redisConnection } from './connection.js';

export const evaluationQueue = new Queue('evaluations', { connection: redisConnection });
export const scanQueue = new Queue('scans', { connection: redisConnection });
export const pdfQueue = new Queue('pdfs', { connection: redisConnection });

export async function addEvaluationJob(data) {
  return evaluationQueue.add('evaluate', data, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
  });
}

export async function addScanJob(data) {
  return scanQueue.add('scan', data, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
  });
}

export async function addPdfJob(data) {
  return pdfQueue.add('generate-pdf', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
  });
}
