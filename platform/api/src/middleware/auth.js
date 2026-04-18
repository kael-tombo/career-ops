import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const PLAN_TIERS = { free: 0, pro: 1, elite: 2 };
const FREE_EVAL_LIMIT = 5;

/**
 * Verifies the Clerk JWT in the Authorization header,
 * then loads the user from the DB and attaches to request.user
 */
export async function requireAuth(request, reply) {
  try {
    // Clerk sends a JWT — verify it with the JWT plugin
    await request.jwtVerify();

    const clerkId = request.user.sub;
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId));

    if (!user) {
      return reply.code(401).send({ error: 'User not found — try signing out and back in' });
    }

    // Reset monthly eval count if it's been > 30 days
    const resetDate = new Date(user.evalResetAt);
    const now = new Date();
    const daysDiff = (now - resetDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) {
      await db.update(users).set({ evalCount: 0, evalResetAt: now }).where(eq(users.id, user.id));
      user.evalCount = 0;
    }

    request.user = { ...request.user, dbId: user.id, plan: user.plan, evalCount: user.evalCount };
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

/**
 * requirePlan('pro') — gates a route to pro+ users.
 * Also enforces eval count limit on free users.
 */
export function requirePlan(minPlan) {
  return async (request, reply) => {
    const userTier = PLAN_TIERS[request.user.plan] ?? 0;
    const requiredTier = PLAN_TIERS[minPlan] ?? 0;

    // Enforce free tier eval limit
    if (request.user.plan === 'free' && minPlan === 'free') {
      if (request.user.evalCount >= FREE_EVAL_LIMIT) {
        return reply.code(402).send({
          error: 'Free tier limit reached',
          code: 'UPGRADE_REQUIRED',
          message: `You've used all ${FREE_EVAL_LIMIT} free evaluations this month. Upgrade to Pro for unlimited.`,
        });
      }
    }

    if (userTier < requiredTier) {
      return reply.code(402).send({
        error: 'Plan upgrade required',
        code: 'UPGRADE_REQUIRED',
        required: minPlan,
        current: request.user.plan,
      });
    }
  };
}
