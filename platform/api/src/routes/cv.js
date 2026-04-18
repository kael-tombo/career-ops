import { requireAuth, requirePlan } from '../middleware/auth.js';
import { addPdfJob } from '../queues/queues.js';
import { db } from '../db/client.js';
import { cvAssets, jobs } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { createReadStream, existsSync } from 'fs';

export async function cvRoutes(app) {
  // POST /api/cv/generate — queue PDF generation for a job (Pro+)
  app.post('/generate', { preHandler: [requireAuth, requirePlan('pro')] }, async (request, reply) => {
    const { jobId } = request.body;
    const userId = request.user.dbId;

    const [job] = await db.select().from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));

    if (!job) return reply.code(404).send({ error: 'Job not found' });

    const queueJob = await addPdfJob({ jobId, userId });
    return reply.code(202).send({ queued: true, queueJobId: queueJob.id });
  });

  // GET /api/cv — list user's generated CVs, joined with job info
  app.get('/', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.user.dbId;

    const rows = await db
      .select({
        id: cvAssets.id,
        jobId: cvAssets.jobId,
        filename: cvAssets.filename,
        storageUrl: cvAssets.storageUrl,
        localPath: cvAssets.localPath,
        createdAt: cvAssets.createdAt,
        company: jobs.company,
        role: jobs.role,
      })
      .from(cvAssets)
      .leftJoin(jobs, eq(cvAssets.jobId, jobs.id))
      .where(eq(cvAssets.userId, userId));

    return rows.map((r) => ({
      ...r,
      status: r.localPath || r.storageUrl ? 'Ready' : 'Generating...',
      job: { company: r.company || 'Unknown', role: r.role || 'Unknown' },
    }));
  });

  // GET /api/cv/:id/download — stream the PDF file
  app.get('/:id/download', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.dbId;

    const [asset] = await db.select().from(cvAssets)
      .where(and(eq(cvAssets.id, id), eq(cvAssets.userId, userId)));

    if (!asset) return reply.code(404).send({ error: 'CV not found' });

    // If stored remotely, redirect
    if (asset.storageUrl) {
      return reply.redirect(asset.storageUrl);
    }

    if (!asset.localPath || !existsSync(asset.localPath)) {
      return reply.code(404).send({ error: 'File not found on disk' });
    }

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${asset.filename}"`);
    return reply.send(createReadStream(asset.localPath));
  });
}

