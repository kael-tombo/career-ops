# Career-Ops + Dashboard — Deep Assessment (July 2026)

## 1. Philosophy Assessment

Career-Ops embodies a **mode-based agent architecture** — markdown files as AI agent instructions, JavaScript/Go scripts as automation, and a data contract ensuring safe evolution. Core tenets:

| Principle | Evidence | Assessment |
|-----------|----------|------------|
| **AI as orchestrator, human-in-the-loop** | `apply.mjs` --never auto-submits; AGENTS.md ethical use policy | Strong. Explicit "quality over quantity" stance. |
| **Data contract** | `DATA_CONTRACT.md` — user layer vs system layer, update-system.mjs | Excellent design. Enables safe auto-updates. |
| **Language-agnostic** | `modes/de/`, `modes/fr/`, `modes/ja/`, `modes/tr/` | Good coverage. Missing: IT, PT-BR markets. |
| **CLI-first, dashboard-second** | Go TUI (1.1K LOC) + Next.js (2K LOC) + Vite (520 LOC) | Fragmented. Three UIs with overlapping features. |
| **Pipeline integrity** | `merge-tracker.mjs`, `verify-pipeline.mjs`, canonical states | Strong validation. Complex but thorough. |
| **Batch processing** | `batch-runner.sh` + `batch-prompt.md` — sub-agents for parallel eval | UNIX-only. Missing: Windows support, cloud distribution. |

**Score: 8/10** — Solid foundation. Fragmentation in dashboard layer is the biggest weakness.

---

## 2. Feature Gap Analysis

### 2.1 Portal Scanner

| Current | Target | Gap |
|---------|--------|-----|
| Greenhouse API only (1 platform) | 1,000+ platforms worldwide | 999 platforms missing |
| Sequential per-company scan | Parallel batch scanning | No concurrency |
| No proxy/rotation | Anti-blocking infrastructure | Rate-limited quickly |
| No CAPTCHA handling | Recaptcha/hCaptcha solving | Blocked on Google/Indeed |
| URL-based dedup only | Semantic dedup + freshness tracking | Duplicates from multiple sources |
| No scheduled scanning | Cron-based automatic scan cycles | Manual only |

### 2.2 Auto-Apply Engine

| Current | Target | Gap |
|---------|--------|-----|
| Basic text fields only | Full ATS-aware form filling | Workday, Taleo, SuccessFactors unsupported |
| No AI answer generation | Smart cover letters + custom answers | Static profile only |
| PDF upload fragile | Native ATS parsing + multi-format | No .docx, .txt fallback |
| Sequential (one job at a time) | Parallel apply agents | Slow throughput |
| Dry-run only (never submits) | Configurable auto-submit with safety | No gradual autonomy |

### 2.3 Dashboard

| Feature | Vite App | Next.js App | Go TUI |
|---------|----------|-------------|--------|
| Overview + charts | ✅ | ✅ | ✅ |
| Tracker with updates | ❌ | ✅ | ✅ |
| Pipeline view | ❌ | ✅ | ✅ |
| Reports with Markdown | ✅ | ❌ (plain `<pre>`) | ✅ |
| Regions explorer | ❌ | ✅ | ❌ |
| Interview prep | ❌ | ✅ | ❌ |
| Scan trigger | ✅ | ❌ | ❌ |
| Tailor/Prep triggers | ✅ | ❌ | ❌ |
| Story Bank viewer | ✅ | ❌ | ❌ |
| Command Palette | ✅ | ❌ | ❌ |
| System Health | ✅ | ❌ | ❌ |
| Real-time updates | ❌ (polling) | ❌ (polling) | N/A (disk reads) |
| Mobile responsive | ❌ | Partial | N/A |

**Key insight:** No single UI has all features. Vite + Next.js = 90% coverage.

### 2.4 Multi-Agent Architecture

| Capability | Current | Target |
|------------|---------|--------|
| Evaluation agents | 1 sequential `claude -p` per job | N parallel agents with orchestration |
| Scanner agents | 1 synchronous Node.js process | Distributed scanning fleet |
| Apply agents | 1 browser tab, sequential | N agents, each in own browser context |
| Follow-up agents | Not implemented | Scheduled follow-up cadence |
| Research agents | Manual (`deep` mode) | Automated company research pipeline |
| CV tailoring agents | Manual (`tailor-assets.mjs`) | AI-driven batch CV generation |
| Agent state management | None | Persistent agent state + recovery |
| Agent coordination | None | Queue + result aggregation |

### 2.5 Analytics & Intelligence

| Capability | Current | Target |
|------------|---------|--------|
| Source tracking | Not tracked | Which platform → which interviews |
| CV version A/B testing | Not possible | Track CV → response rate per version |
| Market intelligence | Manual WebSearch | Automated salary/trend aggregation |
| Predictive scoring | Not implemented | ML model: application → probability of interview |
| Follow-up optimization | Manual | AI-driven timing + message optimization |
| Rejection pattern analysis | `analyze-patterns.mjs` (MISSING!) | Automated + actionable insights |

---

## 3. Redesign Plan — "Career-Ops v2.0"

### Phase 1 — Foundation (THIS SESSION)

#### 1.1 Universal Multi-Platform Scanner
**Files:** `scan-portals.mjs` (rewrite), new platform drivers
- **Lever API** — `GET https://api.lever.co/v0/postings/{company}?mode=json`
- **Ashby API** — `GET https://api.ashbyhq.com/posting-api/job-board/{boardToken}`
- **Workday** — browser-based scraping (career page discovery)
- **Indeed** — browser-based (geo-targeted search per region)
- **LinkedIn** — browser-based (logged-in search, highly rate-limited)
- **Platform driver framework** — `lib/platforms/` — each platform = 1 module

#### 1.2 Background Agent Queue
**Files:** `server.mjs` (rewrite event loop), `lib/queue.mjs` (new)
- In-memory job queue with status tracking
- Background worker pool (configurable parallelism: 1-10)
- Job types: `scan`, `evaluate`, `tailor`, `apply`, `prep-form`, `liveness-check`
- SSE endpoint: `GET /api/events` — push job status updates to dashboard

#### 1.3 Dashboard Consolidation
**Files:** `dashboard-next/` — add Vite features
- Add Markdown rendering to reports (`react-markdown` + `remark-gfm`)
- Add Scan Portal button + job status display
- Add Tailor/Prep buttons on tracker rows
- Add Story Bank viewer
- Add System Health widget
- Add SSE subscription for real-time job status

### Phase 2 — Intelligence (NEXT SESSION)

- Platform coverage expansion (50 → 200+ platforms)
- Distributed agent orchestration
- ML-based scoring model
- A/B CV testing framework

### Phase 3 — Automation (FUTURE)

- Scheduled autonomous scanning + evaluation
- Auto-apply with safety guardrails
- Follow-up automation
- Market intelligence dashboard

---

## 4. Implementation Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Multi-platform scanner | 🔥🔥🔥🔥🔥 | Medium | **P0** |
| Dashboard consolidation | 🔥🔥🔥🔥 | Medium | **P0** |
| SSE + background queue | 🔥🔥🔥🔥🔥 | Medium | **P0** |
| ATS-native auto-apply | 🔥🔥🔥 | High | P1 |
| Agent orchestration | 🔥🔥🔥🔥 | High | P1 |
| Analytics platform | 🔥🔥🔥 | High | P2 |
| ML predictive scoring | 🔥🔥🔥🔥 | Very High | P3 |

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Platform API changes (Lever, Ashby) | Medium | High | Defensive parsing, integration tests |
| LinkedIn/Indeed blocks | High | Medium | Proxy rotation, browser fingerprinting |
| Dashboard fragmentation continues | Medium | High | Consolidate NOW — don't add third UI |
| Agent queue memory pressure | Low | Medium | Circuit breaker, max queue size |
| SSE connection limits | Low | Medium | EventSource auto-reconnect, heartbeat |
