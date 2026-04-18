import { Webhook } from 'svix';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// POST /auth/webhook  — called by Clerk on user.created / user.deleted
export async function authRoutes(app) {
  app.post('/webhook', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return reply.code(500).send({ error: 'CLERK_WEBHOOK_SECRET not set' });
    }

    const svix_id = request.headers['svix-id'];
    const svix_ts = request.headers['svix-timestamp'];
    const svix_sig = request.headers['svix-signature'];

    if (!svix_id || !svix_ts || !svix_sig) {
      return reply.code(400).send({ error: 'Missing Svix headers' });
    }

    const wh = new Webhook(webhookSecret);
    let evt;
    try {
      evt = wh.verify(request.rawBody, {
        'svix-id': svix_id,
        'svix-timestamp': svix_ts,
        'svix-signature': svix_sig,
      });
    } catch (err) {
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    const { id, email_addresses, first_name, last_name } = evt.data;
    const email = email_addresses?.[0]?.email_address;
    const name = [first_name, last_name].filter(Boolean).join(' ');

    if (evt.type === 'user.created') {
      await db.insert(users).values({
        clerkId: id,
        email,
        name,
        plan: 'free',
        evalCount: 0,
      }).onConflictDoNothing();
      console.log(`✅ New user created: ${email}`);
    }

    if (evt.type === 'user.deleted') {
      await db.delete(users).where(eq(users.clerkId, id));
      console.log(`🗑️  User deleted: ${id}`);
    }

    return reply.send({ received: true });
  });
}
