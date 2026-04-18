# Career-Ops Cloud — Deployment Guide

This guide completes the deployment of the three-tier Career-Ops SaaS platform: **Fastify API** (Railway) + **Next.js Web** (Vercel) + **Expo Mobile** (EAS Build).

---

## Prerequisites

You need accounts on:
- [Clerk](https://clerk.com) — Auth
- [Railway](https://railway.app) — API + PostgreSQL + Redis
- [Vercel](https://vercel.com) — Web
- [Stripe](https://stripe.com) — Subscriptions
- [Anthropic](https://console.anthropic.com) — AI evaluations

---

## Step 1 — Clerk Setup

1. Create a new Clerk application.
2. In **API Keys**, copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (frontend)
   - `CLERK_SECRET_KEY` (backend)
   - `CLERK_JWT_PUBLIC_KEY` (used by Fastify to verify JWTs — found under **JWT Templates → RS256**)
3. In **Webhooks**, add an endpoint pointing to your Railway API URL:
   ```
   https://your-api.railway.app/auth/webhook
   ```
   Subscribe to events: `user.created`, `user.deleted`  
   Copy the **Signing Secret** → `CLERK_WEBHOOK_SECRET`

---

## Step 2 — Stripe Setup

1. Create two **Subscription Products** in the Stripe Dashboard:
   - **Career-Ops Pro** — e.g. $19/month
   - **Career-Ops Elite** — e.g. $49/month
2. Copy the **Price IDs** (format: `price_xxxxx`) for each.
3. In **Webhooks**, add:
   ```
   https://your-api.railway.app/api/subscriptions/webhook
   ```
   Subscribe to: `checkout.session.completed`, `customer.subscription.deleted`  
   Copy the **Signing Secret** → `STRIPE_WEBHOOK_SECRET`

---

## Step 3 — Deploy API on Railway

1. Push your repository to GitHub.
2. Log into [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
3. Select the `career-ops` repo.
4. In Service Settings → set **Root Directory** to `platform/api`.
5. Add plugins: **PostgreSQL** and **Redis**. Railway auto-injects `DATABASE_URL` and `REDIS_URL`.
6. Add these **Environment Variables** in the Railway dashboard:

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `3002` |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` |
   | `CLERK_SECRET_KEY` | from Clerk |
   | `CLERK_JWT_PUBLIC_KEY` | from Clerk JWT Templates |
   | `CLERK_WEBHOOK_SECRET` | from Clerk Webhooks |
   | `STRIPE_SECRET_KEY` | from Stripe |
   | `STRIPE_WEBHOOK_SECRET` | from Stripe Webhooks |
   | `STRIPE_PRICE_PRO` | `price_...` |
   | `STRIPE_PRICE_ELITE` | `price_...` |
   | `WEB_URL` | `https://your-app.vercel.app` |

7. **After first deploy**, run the DB migration:
   ```bash
   # From your local machine with DATABASE_URL set:
   cd platform/api
   npm run db:push
   ```

---

## Step 4 — Deploy Web on Vercel

1. Log into [vercel.com](https://vercel.com) → **Add New Project** → Import from GitHub.
2. Set **Framework Preset**: Next.js.
3. Set **Root Directory**: `platform/web`.
4. Add these **Environment Variables**:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | from Clerk |
   | `CLERK_SECRET_KEY` | from Clerk |
   | `NEXT_PUBLIC_API_URL` | `https://your-api.railway.app` |

5. Deploy. Your web app is live at `https://your-app.vercel.app`.
6. Update `WEB_URL` in Railway to match this URL (for CORS).

---

## Step 5 — Mobile (Expo Go / EAS)

For local testing:
```bash
cd platform/mobile
npx expo start
```
Scan the QR code with the **Expo Go** app.

For production builds (requires [EAS CLI](https://docs.expo.dev/eas/)):
```bash
npm install -g eas-cli
eas build --platform ios
eas build --platform android
```

---

## Local Development (No Cloud Required)

```bash
# Terminal 1 — Redis (via Docker)
docker run -p 6379:6379 redis:alpine

# Terminal 2 — PostgreSQL (via Docker)
docker run -p 5432:5432 -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=career_ops postgres:16-alpine

# Terminal 3 — API
cd platform/api
cp .env.example .env   # fill in your keys
npm run db:push        # apply schema
npm run dev

# Terminal 4 — Web
cd platform/web
cp .env.example .env.local  # fill in Clerk keys + NEXT_PUBLIC_API_URL=http://localhost:3002
npm run dev
```
