# Career-Ops Deep Assessment

> **Version assessed:** 1.22.0 | **Date:** 2026-07-27
> **Scope:** AI Engine, Backend Architecture, Frontend Architecture, Infrastructure, Scalability, Security, UI/UX
> **Files analyzed:** ~230 files across backend (Node.js/Fastify), frontend (Next.js 16 + Vite/React), AI modules (15+), 66 providers, Docker, config

---

## Table of Contents

1. [AI Engine Assessment](#1-ai-engine-assessment)
2. [Backend Architecture Assessment](#2-backend-architecture-assessment)
3. [Backend Infrastructure Assessment](#3-backend-infrastructure-assessment)
4. [Backend Scalability Assessment](#4-backend-scalability-assessment)
5. [Frontend Architecture Assessment](#5-frontend-architecture-assessment)
6. [Frontend UI/UX Assessment](#6-frontend-uiux-assessment)
7. [Security Assessment](#7-security-assessment)
8. [Testing & Quality Assessment](#8-testing--quality-assessment)
9. [Data & State Management Assessment](#9-data--state-management-assessment)
10. [Cross-Cutting Issues](#10-cross-cutting-issues)
11. [Prioritized Roadmap](#11-prioritized-roadmap)

---

## 1. AI Engine Assessment

### 1.1 LLM Gateway (`lib/ai/gemini.mjs`)

**What it does:** Multi-provider gateway supporting OpenAI, Grok, Kimi, DeepSeek, Gemini with recursive failover across (provider x model) combinations on quota/error.

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| Gemini SDK import at top level | High | `import { GoogleGenerativeAI } from '@google/generative-ai'` runs at module parse time. If the package is missing, the entire module fails even if user only uses OpenAI. |
| Only first Gemini key used | High | `resolvedKeys[0]` — 3 keys configured but only 1 ever used. Multi-key rotation within the same provider is not implemented. |
| Stale provider cache | Medium | `_providerCache` is populated once at first call. Hot-added env vars (e.g., user sets `OPENAI_API_KEY` while process is running) are never detected. |
| No streaming support | Medium | All calls are request-response. No streaming for real-time token output (cover letters, interview prep). |
| No token counting/cost tracking | Medium | No mechanism to estimate or track token usage per provider. No cost-awareness in provider selection. |
| No timeout propagation | Low | `AbortSignal.timeout()` not passed through to Gemini SDK calls. Slow responses hang indefinitely. |

#### What Could Be Improved

- Dynamic import of provider SDKs — only load what's needed
- Full multi-key rotation for every provider (not just Gemini)
- Token estimation before provider selection (avoid expensive models for short prompts)
- Cost-aware provider routing (prefer cheap models for drafts, expensive for scoring)
- Connection pooling for HTTP-based providers (OpenAI/Grok/Kimi/DeepSeek)
- Streaming API for generation modules (cover letter, interview prep)

### 1.2 AI Modules (`lib/ai/` — 15 files)

**What it does:** Feature modules for cover letters, skill gaps, interview prediction, salary negotiation, keyword optimization, quality scoring, fit explanation, company intel, pipeline forecast, job priority, rejection analysis, auto-matching, followup, deadline tracking.

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| All modules read `cv.md`/`config/profile.yml` from disk synchronously every call | High | `readFileSync` scattered across every module. Blocks event loop. No caching. |
| Duplicate tracker parsing logic in 4+ places | High | `rejection-analyzer.mjs`, `autonomous/pipeline.mjs`, `application-timer.mjs`, `lib/utils.mjs` all parse `applications.md` independently with different regex patterns. |
| JSON file databases with no locking | High | `data/deadlines.json`, `data/auto-queue.json`, `data/followups.json` use `readFileSync`+`writeFileSync` with no mutex. Concurrent writes corrupt data. |
| LLM used as forecasting engine | Medium | `pipeline-forecast.mjs` asks Gemini for dates like "next interview by". LLMs cannot forecast — pure hallucination. |
| `batchPrioritize(jobs)` passes empty `{}` as historical patterns | Medium | `job-priority.mjs` line: `batchPrioritize(jobs)` internally calls `prioritizeJob(job, {})` — the LLM gets zero pattern data. |
| `autoImproveCV` makes 2 LLM calls per CV | Medium | Scores then regenerates, doubling cost. Could be a single call. |
| Sequential batch processing in `bulkAnalyzeKeywords` | Medium | Processes 20 JDs sequentially. No parallelism. |
| No module timeout boundaries | Medium | No timeout per module execution. A slow LLM call in one module blocks the queue. |
| No input validation before LLM calls | Low | `params` object passed straight through to LLM prompts. No schema validation or sanitization. |

#### What Could Be Improved

- Centralized CV/profile cache with file-watcher invalidation
- Single canonical tracker parser module used everywhere
- Migrate JSON file databases to SQLite (already have the schema)
- Replace LLM forecasting with statistical models (moving averages, regression)
- Batch LLM calls where possible (single prompt for multiple evaluations)
- Add timeout per module execution
- Add input schema validation for all module params
- Pre-LLM token estimation to avoid truncation

### 1.3 Memory & Learning System (`lib/memory/index.mjs`)

**What it does:** SQLite-backed AI memory with 5 tables: learnings, feedback, companies, preferences, patterns. Used for score adjustments and pipeline context enrichment.

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| Schema runs at import time | High | `ensureSchema()` is a module-level side effect. Runs DB writes on every `import`. Breaks testability. |
| Duplicate memory store | Medium | `lib/db/schema.sql` has `agent_memory` table with same key-value purpose as `lib/memory/schema.sql`'s `memory_learnings`. Two parallel memory stores. |
| No TTL/decay on preferences | Medium | Preference signals accumulate indefinitely. A preference from 2025 has same weight as one from today. |
| Linear hand-tuned score adjustment | Medium | `getScoreAdjustment()` uses hardcoded weights (+0.3 for interview, +0.5 for offer, etc.) — no learned weights. |
| No dedup key normalization | Medium | "Google", "google", "google.com" are stored as separate companies. |
| `application_id` never populated | Low | `memory_feedback` table has `application_id` column but `recordFeedback()` never sets it. |
| Unbounded data growth | Low | `learnFromEvaluation()` creates a new entry for EVERY evaluation with timestamp key. Millions of rows over time. |

#### What Could Be Improved

- Lazy schema initialization (call `ensureSchema()` explicitly, not at import)
- Consolidate two parallel memory stores into one
- Time-based decay function for preference signals (half-life in days)
- Score adjustment weights learned from feedback outcomes, not hardcoded
- Company name normalization (lowercase, trim, remove TLDs)
- Data pruning/archival for old learnings
- Export memory to markdown for user review

### 1.4 Autonomous Pipeline (`lib/autonomous/pipeline.mjs`)

**What it does:** Three-stage automated pipeline: Scan → Evaluate → Apply. Drives the entire job search automation.

#### Critical Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **Does NOT use the multi-provider gateway** | **Critical** | `stageEvaluate()` imports `@google/generative-ai` directly and calls Gemini SDK. Ignores `gemini.mjs` entirely. No failover, no provider rotation. |
| **Hardcoded Gemini model** | **Critical** | `models/gemini-2.0-flash-001` hardcoded in evaluation prompt. Cannot be configured. |
| **Sends config/profile.yml to Gemini API** | **High** | Profile JSON with email, phone, location, compensation targets, LinkedIn URL is included in LLM evaluation prompts. |
| **File-based pipeline state is fragile** | **High** | `stageEvaluate()` reads/writes `data/pipeline.md` with regex replacements. Concurrent processes corrupt data. |
| **Race condition on report number** | **High** | `getNextReportNum()` counts files in `reports/` directory. Two parallel workers get same number (#749 race pattern from docs). |
| **No timeout per evaluation** | **High** | Slow Gemini responses block the entire pipeline. No per-evaluation timeout. |

#### What Could Be Improved

- Route all LLM calls through `gemini.mjs` gateway
- Make evaluation model configurable via env var or profile
- Strip PII (email, phone, comp targets) from evaluation prompts
- Use SQLite for pipeline state instead of file-based markdown
- Use `reserve-report-num.mjs` before spawning parallel workers
- Add per-evaluation timeout with AbortController
- Add circuit breaker for repeated provider failures

---

## 2. Backend Architecture Assessment

### 2.1 Server Layer (`server.mjs` + `lib/server/routes/`)

**What it does:** Fastify v5 API server with 11 route modules, CORS, rate limiting, static file serving, SSE streaming.

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| No authentication on any endpoint | **Critical** | Every API endpoint is wide open. CORS `origin: true` echoes back any origin. |
| Path traversal in file-serving routes | **Critical** | `reports.mjs:43`, `diagnostics.mjs:56`: `decodeURIComponent` alone does not prevent `../../../etc/passwd` traversal. |
| No input validation on most routes | High | Only `@fastify/rate-limit` is registered. Routes accept arbitrary JSON bodies without Fastify schema validation. |
| Static files served via `readFileSync` | Medium | `setNotFoundHandler` reads files synchronously — blocks event loop. Should use stream or `sendFile`. |
| CORS origin echoing | Medium | `origin: true` on production means any website can make API calls from a browser. |
| No request ID tracking | Low | No `x-request-id` header. Hard to correlate logs across requests. |
| Route file for `applications.mjs` has no pagination | Low | `GET /api/applications` returns ALL entries. |

#### What Could Be Improved

- Add API key authentication (static key in env var, Bearer token header)
- Sanitize all file-path parameters against `../` traversal
- Add Fastify JSON Schema validation on all POST/PUT endpoints
- Use `reply.sendFile()` from `@fastify/static` instead of `readFileSync`
- Add request ID middleware (`x-request-id`)
- Add pagination to list endpoints (limit/offset)
- Add OpenAPI/Swagger docs via `@fastify/swagger`

### 2.2 Job Queue (`lib/queue.mjs`)

**What it does:** SQLite-backed persistent job queue with 12 handlers, exponential backoff (3 retries), dead-letter queue, SSE events, recurring scheduler.

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| Process spawning for most handlers | Medium | Handlers spawn child processes via `_spawnWithTimeout()` instead of running in-process. Adds overhead. |
| Max concurrency of 2 | Medium | Hardcoded bottleneck. Pipeline, scan, and apply cannot overlap. |
| No job cancellation API | Medium | Jobs stuck in "running" state can't be cancelled — only recovered on restart. |
| No per-type rate limiting | Low | Scan jobs and eval jobs share same concurrency pool. |
| SSE listener has no backpressure handling | Low | Client disconnects cause memory leaks (SSE subscriptions never cleaned up). |
| Poll-based (`SELECT ... LIMIT 1`) | Low | Polls DB instead of using SQLite's `sqlite3_update_hook` or a notification mechanism. |

#### What Could Be Improved

- In-process execution for all handlers (avoid child process overhead)
- Configurable concurrency per job type
- Job cancellation endpoint with cleanup
- SSE subscription cleanup on client disconnect
- Use SQLite update hook for push-based queue notification
- Add priority levels to job queue
- Add delayed/scheduled job support

### 2.3 Daemon (`daemon.mjs`)

**What it does:** 24/7 background pipeline worker with embedded HTTP server, SSE streaming, state persistence.

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| Own embedded HTTP server (raw Node.js) | Medium | Duplicates Fastify server. Runs on a different port. Custom SSE implementation. |
| No actual daemonization | Medium | `--daemon` flag sets a flag but calls `process.exit()` — does NOT detach from terminal. |
| PID file locking is fragile | Medium | Stale PID files require `--force` cleanup. No atomic PID check. |
| Logs append indefinitely | Low | `data/daemon.log` grows unbounded. No log rotation. |
| Pipeline workers config unused | Low | `PIPELINE_WORKERS` env var is declared but never used for parallelism. |

#### What Could Be Improved

- Merge daemon HTTP server into the Fastify API server
- Use `process.detached` or a proper process manager (PM2/supervisord)
- Replace PID file with a SQLite row or Redis key
- Add log rotation (date-based or size-based)
- Actually implement parallel workers per the env var

### 2.4 Database Layer (`lib/db/index.mjs`)

**What it does:** SQLite connection manager with WAL mode, singleton pattern, schema auto-init, domain query helpers.

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| Global mutable singleton (`_db`) | High | Impossible to test in isolation. Tests cannot use separate databases. |
| Schema init uses `split(';')` | Medium | Breaks if SQL contains semicolons in string literals. Should use proper SQL parser. |
| No prepared statement caching | Medium | Every query calls `db.prepare()` fresh. Should cache prepared statements. |
| No migration system | Medium | `schema_version` table exists but no migration logic. Schema changes require manual SQL. |
| `agent_memory` table is dead code | Medium | Table defined in schema but unused by any code (memory system uses its own schema). |

#### What Could Be Improved

- Replace singleton with factory function for test isolation
- Use a proper SQL parser or split on `;\n` (semicolon + newline) to avoid string literal issues
- Cache prepared statements per query type
- Implement migration system (versioned SQL files, auto-apply)
- Remove `agent_memory` table or consolidate with memory system

---

## 3. Backend Infrastructure Assessment

### 3.1 Docker Deployment

**What it does:** 4 services (api, daemon, dashboard, n8n) sharing a bridge network with bind-mounted data volumes.

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| **Playwright not installed in api/daemon images** | **Critical** | `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` in `Dockerfile.server` and `Dockerfile.daemon`. Playwright calls will crash at runtime. |
| Daemon starts before API is healthy | Medium | `depends_on: api: condition: service_started` — starts when container starts, not when healthy. |
| No restart policy on n8n | Medium | Missing `restart: unless-stopped`. n8n will stop on crash. |
| No TLS termination | Medium | All services exposed on plain HTTP. No reverse proxy for HTTPS. |
| Multi-service images are large | Low | Node 22 slim + build deps. No multi-stage optimization for api/daemon. |
| `.dockerignore` only added recently | Low | Previously, `node_modules/`, `.git/`, and other large dirs were copied into images. |

#### What Could Be Improved

- Install Chromium in api/daemon Dockerfiles (or add a dedicated playwright service)
- Use `depends_on: condition: service_healthy` for daemon
- Add Traefik/nginx reverse proxy with Let's Encrypt TLS
- Multi-stage builds for api/daemon (builder → runner)
- Add Prometheus metrics exports to all services
- Add centralized logging (Loki/Datadog)

### 3.2 Configuration & Secret Management

**What it does:** `.env` for secrets, `config/profile.yml` for user data, YAML configs for regions/portals.

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| API keys passed via env vars in docker-compose.yml | High | Keys visible in `docker ps`, docker-compose.yml, and process listings. |
| No encryption at rest for secrets | High | `.env` and `.env.docker` stored as plaintext on disk. |
| `config/profile.yml` contains PII | Medium | Email, phone, location, LinkedIn URL, comp targets — sent to external API (Gemini) in evaluation prompts. |
| No config validation at startup | Low | Config files are validated on first use, not at server startup. Misconfigurations discovered at runtime. |

#### What Could Be Improved

- Use Docker secrets for API keys (`docker secret create`)
- Add .env file encryption (age/sops/git-crypt)
- Strip PII from data sent to external LLM APIs
- Add startup-time config validation with clear error messages
- Add `--validate` CLI flag for config checking

---

## 4. Backend Scalability Assessment

### 4.1 Concurrency & Parallelism

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| Pipeline runs 3 stages sequentially | High | `runFullPipeline()` does scan → evaluate → apply with no stage overlap. Each stage waits for previous to finish. |
| File-based state prevents horizontal scaling | High | `pipeline.md`, `scan-history.tsv` rely on single-process file I/O. Cannot run multiple daemon instances. |
| `PIPELINE_WORKERS` env var is dead code | Medium | Declared in `daemon.mjs` and Dockerfile but never actually used for parallelism. |
| Global discovery creates hundreds of browser pages | Medium | `_searchCountryBoards()` launches one browser per country batch with no limit on total pages. |
| No distributed queue | High | SQLite-backed queue is single-node. Cannot distribute across machines. |

#### What Could Be Improved

- Run pipeline stages in parallel where possible (scan + evaluate can overlap)
- Migrate state to PostgreSQL (via `platform/` alternative infra) for horizontal scaling
- Actually implement parallel pipeline workers
- Add browser pool with max concurrency for global discovery
- Use Redis or RabbitMQ as distributed job queue for multi-node deployment

### 4.2 Caching

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| CV/profile/config read from disk on every LLM call | High | Every AI module reads `cv.md`, `config/profile.yml` synchronously. No caching. |
| No HTTP response caching | Medium | API responses not cached. Same data refetched every 5 seconds. |
| `_resumeCache` never invalidated | Medium | `lib/resume-manager.mjs` caches resume content but never checks file modification time. |
| Portal config re-parsed on every scan | Low | `loadPortalsConfig()` re-reads and parses YAML on every scan call. |
| No Redis/memcached anywhere | Low | No in-memory data store for frequently accessed data. |

#### What Could Be Improved

- In-memory cache for CV/profile/config with file-watcher invalidation (`fs.watch`)
- Add `Cache-Control` headers to API responses
- Add file modification time check to resume cache
- Cache parsed portal config with TTL
- Add Redis container for shared caching across services

### 4.3 Resource Management

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| Playwright browser instances not reused | Medium | `stageScan()` creates a new browser per portal. Apply engine launches/closes browser per application. |
| No connection pooling for LLM API calls | Medium | Every LLM call opens a new HTTP connection. No keep-alive reuse. |
| Event loop blocked by sync I/O | Medium | `readFileSync`/`writeFileSync` in numerous async contexts blocks event loop for other requests. |
| Memory growth from unbounded caches | Low | `_seenUrls` in scanner-core, `allResults` in sitemap-crawler grow without limit during a run. |

#### What Could Be Improved

- Reuse browser instances across scans (pass `options.browser` in chain)
- Add HTTP keep-alive agent for LLM API connections
- Replace all sync file I/O in async functions with `fs.promises`
- Add memory caps for in-memory caches (LRU eviction)

---

## 5. Frontend Architecture Assessment

### 5.1 Dashboard-Next (Next.js 16)

**What it does:** 18-page dashboard with overview, tracker, pipeline, analytics, AI tools, memory browser, autonomous control, global discovery, providers config.

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| **No Server Components used** | **High** | Every page is `'use client'`. No React Server Components, no server-side data fetching. The entire dashboard is a client-side SPA inside Next.js routing — defeats Next.js SSR/SSG benefits. |
| **Data refetch duplication** | **High** | 7+ pages independently call `useDashboard()` which refetches ALL 7 API endpoints every 5 seconds. One page mounting triggers 7+ fetches per page. |
| **No global state management** | Medium | No Zustand, Redux, Context, or React Query. Every page manages its own state. No shared cache between pages. |
| `NEXT_PUBLIC_API_URL` duplicated in 10+ files | Medium | Each AI page and several dashboard pages redefine `const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'` instead of importing from `lib/api.ts`. |
| `safeScore` function duplicated in Overview and Analytics | Medium | Same 4-line function `safeScore` defined identically in two page files. |
| Loading states inconsistent | Medium | Some pages use `<LoadingSpinner>`, others inline spinner HTML, others just show "Loading..." text. |
| No index page for AI section | Low | `/ai/forecast`, `/ai/skills` etc. exist but `/ai/quality` linked from AI overview returns 404 if page missing. |
| No keyboard navigation | Low | Tables are not keyboard-accessible (no tab/arrow navigation for rows). |
| No persistent query parameters | Low | URL doesn't reflect filter/search state. Refreshing page resets all filters. |

#### What Could Be Improved

- Use React Server Components for data fetching where possible (static config, read-only data)
- Use React Query (TanStack Query) for client-side data with stale-while-revalidate caching
- Add Zustand or Context for shared state (filter state, selected report)
- Remove duplicated API URL — single export from `lib/api.ts`
- Extract `safeScore` and other utilities to `lib/utils.ts`
- Standardize loading state across all pages (use shared `<LoadingSpinner>`)
- Add URL query param sync for filters/search
- Add 404 handling for missing routes
- Add keyboard navigation to tables

### 5.2 Dashboard-Legacy (Vite + React)

**What it does:** 893-line single-file React app with 7 tabs, command palette, slide-over panel.

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| Single 893-line file | **Critical** | All components, helpers, state, styles in one file. Impossible to maintain. |
| No routing library | High | Tab switching via `useState`. No URL-based routing, no deep linking. |
| No TypeScript | Medium | Plain JSX. No type safety. Runtime errors for missing fields. |
| Static sample data only | Medium | `data.json` is disconnected from live API. Doesn't work without Vite dev proxy. |
| No code splitting | Medium | Entire app loads in one bundle. Slow initial load. |
| Catppuccin theme not responsive | Low | Theme variables only. No dark/light mode toggle. |

#### Recommendation

The legacy dashboard should be **deprecated** once dashboard-next achieves full feature parity. The only unique features are:
- Command palette (Ctrl+K) — could be ported to dashboard-next
- Slide-over panel animation — could be ported
- Column-sortable tracker table — should be added to dashboard-next
- Static sample data — useful for offline dev, could be added to dashboard-next as fixture

### 5.3 Component Architecture

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| Components are page-specific, not reusable | Medium | `StatCard` is only used on Overview page. `RecentActivity` is only used on Overview page. |
| No composition patterns | Medium | Pages are monolithic. AI pages (quality, skills, intel) each render their own form, results, loading. |
| No shared form components | Medium | Add-to-pipeline form duplicated in tracker and pipeline pages. |
| No toast/notification system | Low | Dashboard-next has no global toast system (legacy dashboard has one). |

#### What Could Be Improved

- Create shared component library: `DataTable`, `SearchInput`, `StatusBadge`, `ScoreBadge`, `StatCardGroup`
- Extract AI page patterns into reusable layout: `AIPageLayout` with shared loading/error/empty states
- Add global toast/notification system (Sonner, react-hot-toast)
- Create shared form components (`FilterBar`, `SearchInput`, `AddForm`)

---

## 6. Frontend UI/UX Assessment

### 6.1 Dashboard-Next UX

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| No mobile sidebar collapse | Medium | Sidebar is fixed width (w-56/w-64). No hamburger menu. Unusable on mobile screens. |
| No loading skeleton | Medium | Pages show spinner text "Loading..." instead of skeleton placeholders. Feels sluggish. |
| No error recovery on API failure | Medium | Most pages show empty state or spinner forever on API failure. None have retry UI (except Global page with ErrorBoundary). |
| Tables have no column sorting | Medium | Tracker and pipeline tables have no click-to-sort headers. User must scroll through unsorted data. |
| No dark/light mode toggle | Medium | Tailwind config supports dark mode classes but no toggle is exposed. |
| No empty state illustrations | Low | Empty tables show "No applications match your search" — utilitarian, no visual guidance. |
| No progressive enhancement | Low | JD textareas accept plain text but don't show character count or preview. |
| Chart interactivity is basic | Low | Recharts charts don't have tooltips, zoom, or click-through to detail. |

#### What Could Be Improved

- Add responsive sidebar with hamburger toggle (mobile-first)
- Replace text loading with skeleton placeholders (shadcn/ui skeleton)
- Add retry buttons on API failures with error messages
- Add column sorting to all tables
- Add dark/light mode toggle with persistence
- Add visual empty states with helpful CTAs
- Add character count + preview to textareas
- Enhance chart interactivity (tooltips, click-to-filter)

### 6.2 Dashboard-Legacy UX

**Strengths to preserve:**
- Command palette (Ctrl+K) for power users — instant navigation
- Slide-over panel for report viewing — smooth, contextual
- Column sorting in tracker — click to sort by any column
- Status pill filters — quick filtering by application status
- Catppuccin Mocha theme — visually polished, consistent
- Toast system — non-blocking notifications for async operations

### 6.3 Accessibility

#### What's Wrong

| Issue | Severity | Detail |
|-------|----------|--------|
| No aria labels on interactive elements | High | Buttons, links, form controls lack `aria-label` attributes. Screen reader unfriendly. |
| No keyboard navigation in tables | High | Table rows are not focusable. No keyboard shortcuts for common actions. |
| Color contrast not validated | Medium | Tailwind default colors may not meet WCAG AA contrast ratios. |
| No focus indicators | Medium | Custom focus states not defined. Default browser focus rings may be clipped by Tailwind resets. |
| No skip-to-content link | Low | No skip navigation link for keyboard users. |

#### What Could Be Improved

- Audit all interactive elements for aria labels
- Add keyboard navigation to data tables (arrow keys, Enter to select)
- Run WCAG contrast audit (axe-core or Lighthouse)
- Add visible focus indicators (ring offsets, high-contrast outlines)
- Add skip-to-content link at top of layout

---

## 7. Security Assessment

### 7.1 Authentication & Authorization

| Issue | Severity | Detail |
|-------|----------|--------|
| **No authentication on any API endpoint** | **Critical** | All 30+ endpoints accessible without any auth. Anyone who reaches the port has full access. |
| **CORS allows any origin** | **High** | `origin: true` in development, implied in production. CSRF possible. |
| **Daemon HTTP server has no auth** | **High** | Port 4173 embedded HTTP server has `Access-Control-Allow-Origin: *` and no auth. Pipeline triggers unprotected. |
| **No API key rotation mechanism** | Medium | No way to rotate API keys without restarting services. |

### 7.2 Data Exposure

| Issue | Severity | Detail |
|-------|----------|--------|
| **Path traversal in 3 endpoints** | **Critical** | `/api/reports/:filename`, `/api/pdf/:filename`, `/api/interview-prep/:filename` accept arbitrary paths. `decodeURIComponent` alone is insufficient protection. |
| **Profile PII sent to external LLM API** | **High** | `config/profile.yml` (email, phone, comp targets, LinkedIn URL) included in Gemini evaluation prompts. |
| **API diagnostics reveals key status** | Medium | `GET /api/diagnostics` returns "OK" or "MISSING_KEY" for each API key — reveals which providers are configured. |
| **Plugin system strips Authorization header but not other headers** | Medium | `plugins/_net.mjs` removes `authorization` but not `cookie`, `x-api-key`, or custom auth headers from plugin fetch calls. |

### 7.3 Infrastructure Security

| Issue | Severity | Detail |
|-------|----------|--------|
| API keys in docker-compose.yml env vars | High | Visible in `docker ps`, `docker inspect`, CI logs. |
| n8n has `N8N_SECURE_COOKIE=false` | Medium | n8n dashboard runs with insecure cookies. |
| No HTTPS/TLS anywhere | Medium | All services on plain HTTP. Credentials transmitted in cleartext. |
| Server binds to `0.0.0.0` by default | Medium | Exposes all network interfaces. Should bind to `127.0.0.1` when behind reverse proxy. |

### 7.4 Regulatory & Legal Risks

| Issue | Severity | Detail |
|-------|----------|--------|
| **Google search scraping violates ToS** | **High** | `search-engines.mjs` scrapes Google 180+ TLDs. Anti-detection layer explicitly evades bot detection. |
| **Indeed/LinkedIn scraping violates ToS** | **High** | Indeed and LinkedIn scrapers in `search-jobs.mjs` and `scan/platforms/`. |
| **GDPR implications** | Medium | System processes personal data (CV, profile, applications) with no data retention policy or deletion mechanism. |

---

## 8. Testing & Quality Assessment

### 8.1 Test Coverage

| Area | Coverage | Assessment |
|------|----------|------------|
| Provider plugins | ~63 tests | Good coverage. One test per provider. |
| Core utilities | Integration tests | `merge-tracker.test.mjs`, `stats.test.mjs`, `scan-*.test.mjs` cover key data flows. |
| AI modules | **None** | 15 AI modules have zero tests. No mock LLM responses. |
| API routes | **None** | 11 route files have zero tests. No integration tests with Fastify inject. |
| Frontend | **None** | 33 Next.js files, 5 legacy files — zero tests. |
| Memory system | **None** | 503-line memory module has zero tests. |
| Database layer | **None** | 307-line DB module has zero tests. |
| Queue system | **None** | 450-line queue module has zero tests. |
| Daemon | **None** | 517-line daemon has zero tests. |
| Docker | **None** | No Dockerfile smoke tests. |

### 8.2 Test Infrastructure

| Issue | Severity | Detail |
|-------|----------|--------|
| `test-all.mjs` runs all tests sequentially | Medium | No parallel test execution. CI runs take longer than needed. |
| No test fixtures for LLM responses | High | AI module tests would require mocking `gemini.mjs`. No mock infrastructure exists. |
| No CI pipeline in GitHub Actions | Medium | `.github/workflows/` exists but may not run tests on PR/merge. |
| No test coverage reporting | Low | No nyc/istanbul or c8 coverage reporting. |

### 8.3 Code Quality

| Issue | Severity | Detail |
|-------|----------|--------|
| Copy-paste code across 5 platform scanners | Medium | `applyTitleFilter()` duplicated identically in 5 scanner files. |
| Dead code in sitemap-crawler (lines 179-203 duplicate 148-174) | Medium | Code after a `return` statement is unreachable copy-paste. |
| Typo in schema-extractor: `v.minValue \|\| v.minValue` | Low | Should be `v.minValue \|\| v.maxValue`. Breaks salary extraction. |
| Global mutable state in 3+ modules | Medium | `_db`, `_providerCache`, `_resumeCache`, `_seenUrls` are module-level singletons. |
| Mixed sync/async patterns | Medium | `readFileSync` inside `async` functions defeats async benefits. |

---

## 9. Data & State Management Assessment

### 9.1 Storage Strategy

| Store | Technology | Concurrent Writes | Migration |
|-------|-----------|-------------------|-----------|
| Applications | `applications.md` (markdown) + SQLite | Fragile (no locking) | Manual |
| Pipeline | `pipeline.md` (markdown) + SQLite | Fragile (regex replace) | Manual |
| Scan history | `scan-history.tsv` + SQLite | `appendFileSync` race | Manual |
| Job queue | SQLite (`job_queue`) | WAL mode, OK | Schema version |
| Memory | SQLite (separate DB) | WAL mode, OK | No migration |
| Deadlines | `data/deadlines.json` | **No locking** | None |
| Auto-queue | `data/auto-queue.json` | **No locking** | None |
| Followups | `data/followups.json` | **No locking** | None |
| Daemon state | `data/daemon-state.json` | **No locking** | None |

### 9.2 Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **Dual-write to markdown + SQLite** | **High** | Applications, pipeline, scan history are written to BOTH markdown files AND SQLite. No atomicity — one can succeed while other fails. |
| **3 JSON file databases with no locking** | **High** | deadlines.json, auto-queue.json, followups.json use `readFileSync`+`writeFileSync` with no file locking. Concurrent access corrupts data. |
| **Trackable markdown files are hard to parse reliably** | Medium | `applications.md` and `pipeline.md` are human-readable markdown tables used as data stores. 4+ different regex parsers exist. |
| **No data archival/deletion policy** | Low | Old evaluations, scan history, and memory entries accumulate forever. |

### 9.3 What Could Be Improved

- Make SQLite the single source of truth. Use markdown exports only for git-tracked human review.
- Migrate all JSON file databases to SQLite
- Add write-ahead logging or file locking for any remaining file-based stores
- Add data archival job (archive entries older than X days to separate table)
- Add data export/import for backup and restore

---

## 10. Cross-Cutting Issues

### 10.1 Two LLM Call Paths

The system has **two entirely separate LLM invocation patterns** that don't share the same gateway:

| Path | Files | Provider | Failover |
|------|-------|----------|----------|
| Multi-provider gateway | `lib/ai/gemini.mjs` + 15 AI modules | OpenAI/Grok/Kimi/DeepSeek/Gemini | Yes (rotates on 429/404) |
| Direct Gemini SDK | `lib/autonomous/pipeline.mjs`, `lib/autonomous/tailor-cv.mjs` | Gemini only (hardcoded) | **No failover** |

**Fix:** Route autonomous pipeline and CV tailor through `lib/ai/gemini.mjs`.

### 10.2 Duplicate Parsers

`applications.md` is parsed by at least 4 different implementations with different regex patterns:
- `lib/ai/rejection-analyzer.mjs`
- `lib/ai/application-timer.mjs`
- `lib/autonomous/pipeline.mjs`
- `lib/utils.mjs`

**Fix:** Create a single canonical tracker parser in `lib/utils.mjs` and use it everywhere.

### 10.3 Configuration Sprawl

Configuration is spread across multiple formats:
- `.env` — API keys (key=value)
- `config/profile.yml` — user profile (YAML)
- `config/regions.yml` — regional settings (YAML)
- `portals.yml` — portal config (YAML)
- `templates/states.yml` — canonical states (YAML)
- `templates/benchmarks.yml` — scoring thresholds (YAML)
- `modes/_profile.md` — archetypes, narrative (markdown)
- `modes/_custom.md` — house rules (markdown)

**Fix:** Consolidate where possible. Profile, archetypes, and narrative could merge into `config/profile.yml`.

---

## 11. Prioritized Roadmap

### P0 — Must Fix (Security & Data Integrity)

| # | Item | Area | Effort |
|---|------|------|--------|
| 1 | Add API key authentication to all endpoints | Security | 2-3 days |
| 2 | Fix path traversal in reports/pdf/interview-prep routes | Security | 1 day |
| 3 | Install Chromium in Docker images (remove `SKIP_BROWSER_DOWNLOAD`) | Infrastructure | 1 day |
| 4 | Migrate JSON file DBs (deadlines, auto-queue, followups) to SQLite | Data | 2 days |
| 5 | Add file locking or atomic writes to all markdown/TSV file operations | Data | 2 days |
| 6 | Route autonomous pipeline and CV tailor through multi-provider gateway | AI Engine | 1 day |

### P1 — Should Fix (Architecture & Reliability)

| # | Item | Area | Effort |
|---|------|------|--------|
| 7 | Strip PII from data sent to external LLM APIs | Security | 1 day |
| 8 | Make evaluation model configurable (not hardcoded) | AI Engine | 0.5 day |
| 9 | Replace singleton DB with factory for test isolation | Backend | 2 days |
| 10 | Add request validation (Fastify JSON Schema) to all POST/PUT routes | Backend | 3-4 days |
| 11 | Add per-AI-module timeout via AbortController | AI Engine | 1 day |
| 12 | Consolidate two parallel memory stores into one | AI Engine | 1 day |
| 13 | Add migration system for SQLite schema changes | Backend | 1 day |
| 14 | Merge daemon HTTP server into Fastify API | Backend | 2 days |
| 15 | Create single canonical tracker parser module | Backend | 1 day |

### P2 — Good to Fix (UX & Developer Experience)

| # | Item | Area | Effort |
|---|------|------|--------|
| 16 | Use React Server Components for dashboard data fetching | Frontend | 3-4 days |
| 17 | Add React Query with stale-while-revalidate caching | Frontend | 3 days |
| 18 | Add column sorting and pagination to all tables | Frontend | 2 days |
| 19 | Add responsive sidebar with mobile hamburger toggle | Frontend | 2 days |
| 20 | Add skeleton loading states to all pages | Frontend | 1 day |
| 21 | Add dark/light mode toggle | Frontend | 1 day |
| 22 | Remove duplicated `NEXT_PUBLIC_API_URL` — single export | Frontend | 0.5 day |
| 23 | Add keyboard navigation and aria labels for accessibility | Frontend | 3 days |
| 24 | Add OpenAPI/Swagger docs for all API endpoints | Backend | 2 days |
| 25 | Add Prometheus metrics to all services | Backend | 2 days |

### P3 — Nice to Have (Performance & Polish)

| # | Item | Area | Effort |
|---|------|------|--------|
| 26 | Add Redis for shared caching and distributed queue | Infrastructure | 3 days |
| 27 | Add cost-aware LLM provider routing (cheap vs expensive models) | AI Engine | 2 days |
| 28 | Implement parallel pipeline workers per `PIPELINE_WORKERS` env var | Backend | 3 days |
| 29 | Add proper CI/CD pipeline (GitHub Actions with test + lint + build) | Devops | 2 days |
| 30 | Add token counting and cost tracking for all LLM calls | AI Engine | 2 days |
| 31 | Add Playwright reuse pool for browser instances | Backend | 2 days |
| 32 | Add log rotation for daemon.log and other logs | Infrastructure | 0.5 day |
| 33 | Deprecate legacy Vite dashboard once next.js has parity | Frontend | 1 day |
| 34 | Add unit tests for all AI modules (with LLM mocking) | Testing | 5 days |
| 35 | Add API integration tests with Fastify inject | Testing | 3 days |
| 36 | Add sentiment decay to memory preferences | AI Engine | 1 day |
| 37 | Replace LLM forecasting with statistical models | AI Engine | 2 days |

---

## Summary

Career-Ops v1.22.0 is an ambitious, well-architected system with strong modular design, extensive provider coverage (66 providers), multi-language support (18 markets), and a powerful automation pipeline. The assessment identified **4 critical security issues**, **6 high-severity architectural problems**, and **numerous medium/low issues** across 10 evaluated dimensions.

The core tension is between **ambitious scope** (100+ countries, all ATS platforms, autonomous pipeline) and **production readiness** (no auth, file-based state, no tests). The P0-P1 roadmap (~45 days of focused work) would address all critical security issues, consolidate state management, and significantly improve reliability and testability.

**Strongest assets:** Modular plugin system, multi-provider LLM gateway, 66 provider integrations, multi-language mode system, safety-first defaults (SAFE_MODE, dry-run).

**Weakest areas:** No authentication, no tests for AI/backend modules, fragmented data storage (markdown + JSON + SQLite × 2), unsecured file-serving routes, two parallel LLM call paths.
