import Stripe from 'stripe';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function subscriptionsRoutes(app) {
  // GET /api/subscriptions — current plan info
  app.get('/', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.user.dbId;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return {
      plan: user.plan,
      evalCount: user.evalCount,
      evalLimit: user.plan === 'free' ? 5 : null,
    };
  });

  // POST /api/subscriptions/checkout — create Stripe Checkout session
  app.post('/checkout', { preHandler: [requireAuth] }, async (request, reply) => {
    const { plan } = request.body; // 'pro' | 'elite'
    const userId = request.user.dbId;
    const [user] = await db.select().from(users).where(eq(users.id, userId));

    const priceId = plan === 'elite'
      ? process.env.STRIPE_PRICE_ELITE
      : process.env.STRIPE_PRICE_PRO;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      metadata: { userId, plan },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.WEB_URL}/app/dashboard?upgraded=true`,
      cancel_url: `${process.env.WEB_URL}/pricing`,
    });

    return { url: session.url };
  });

  // POST /api/subscriptions/portal — Stripe customer billing portal
  app.post('/portal', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.dbId;
    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user.stripeCustomerId) {
      return reply.code(400).send({ error: 'No active subscription' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.WEB_URL}/app/settings`,
    });

    return { url: session.url };
  });

  // POST /api/subscriptions/webhook — Stripe events
  app.post('/webhook', { config: { rawBody: true } }, async (request, reply) => {
    const sig = request.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return reply.code(400).send({ error: `Webhook error: ${err.message}` });
    }

    const session = event.data.object;

    if (event.type === 'checkout.session.completed') {
      const { userId, plan } = session.metadata;
      await db.update(users).set({
        plan,
        stripeCustomerId: session.customer,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));
      console.log(`💳 User ${userId} upgraded to ${plan}`);
    }

    if (event.type === 'customer.subscription.deleted') {
      // Downgrade to free on cancellation
      await db.update(users).set({ plan: 'free', updatedAt: new Date() })
        .where(eq(users.stripeCustomerId, session.customer));
      console.log(`⬇️  Subscription cancelled for customer ${session.customer}`);
    }

    return { received: true };
  });
}
