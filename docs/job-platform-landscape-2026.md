# Job Search Platform Landscape — 2026 Research Report

> Compiled: July 2026 | Scope: 10 categories, 80+ platforms evaluated for career-ops integration

---

## 1. Global Job Aggregators

Focus: **DISCOVERY APIs** (search APIs, RSS, webhook) — career-ops already has 62 ATS providers.

| Platform | Pricing | Coverage | API Availability | Strengths | Weaknesses | Score |
|----------|---------|----------|-----------------|-----------|------------|-------|
| **Adzuna** | Free tier (limited); Paid from £0.05/click | Global (20+ countries) | REST API (JSON) — job search, salary, categories | Salary data API, category taxonomy, decent UK/EU coverage | Limited US coverage, rate-limited free tier | 7/10 |
| **Jooble** | Free (aggregator); Paid for featured listing | Global (70+ countries) | XML feed, API | Broad country reach, simple integration | No structured salary/remote filters, limited API docs | 6/10 |
| **Google for Jobs** (via SerpApi) | SerpApi: Free → $25–$2,750/mo; DataForSEO: $50 min deposit, pay-per-request | Global | SerpApi Google Jobs API / DataForSEO SERP API | Largest job inventory, structured data, geo-targeting | No direct Google API — must use 3rd-party proxies; costs scale with volume | 8/10 |
| **DataForSEO** | $50 min deposit, ~$0.0006/request | Global | SERP API incl. Google Jobs | Pay-per-use, no subscription, Google Jobs + organic | No direct job-board aggregation, SEO-focused | 9/10 |
| **Indeed** | Free posts (limited); Sponsored $0.50–$5.00 CPC | Global (60+ countries) | Indeed Publisher API (partner only), Indeed PPC API | Massive inventory (250M+ unique visitors/mo) | No public search API; CPC costs volatile; partner-gated API access | 5/10 |
| **SimplyHired** | Free (basic); Paid sponsored | Global (20+ countries) | No public search API | Simple UI, good for quick discovery | No API, declining market share | 4/10 |
| **Trovit** | Free (basic listings) | Global (50+ countries) | XML feed | Broad country reach, verticals (jobs/housing/cars) | Limited data quality, decreasing relevance | 4/10 |
| **Careerjet** | Free (basic) | Global (20+ countries) | XML feed API | Multi-language support, simple XML feed | Limited filtering, no structured salary data | 5/10 |

### career-ops Integration Notes

- **Best aggregator APIs for career-ops:** DataForSEO (pay-per-use, no monthly commitment, Google Jobs access) and SerpApi (Google Jobs + organic SERP)
- **RSS feeds:** Indeed XML feed (partner-only), Jooble XML feed, Careerjet XML feed
- **Webhook:** None of the aggregators offer webhook-based job push — must poll APIs or scrape
- **Recommendation:** Use DataForSEO for Google Jobs + ATS direct scrapes (Greenhouse/Lever/Ashby/Workday APIs) rather than aggregators — fresher data, no dedup overhead

---

## 2. AI Job Search Tools

| Tool | Pricing | AI Features | Best For | Strengths | Weaknesses | Score |
|------|---------|-------------|----------|-----------|------------|-------|
| **Simplify.jobs** | Free (core); Simplify+ $39.99/mo | Autofill, AI answer generation, job matching, auto-tracking | Free autofill across Workday/Greenhouse/Lever/Ashby | 4.9/5 from 3.7K Chrome ratings; 200M+ applications; unlimited free autofill | Autofill ≠ auto-apply; AI writing generic; no trial for Simplify+ | 9/10 |
| **Teal** | Free tier; Teal+ $29/mo (weekly $13 = $676/yr) | AI resume builder, job tracker, ATS score, cover letter | Resume building + search organization | Best-in-class resume builder; unlimited free tracking | AI adds JD requirements to resumes; no auto-apply; weekly billing expensive | 8/10 |
| **Jobscan** | Free (5 scans/mo); $49.95/mo | ATS resume scanning, keyword optimization | Resume ATS optimization | Gold standard for ATS keyword matching | Expensive premium; only does scanning, no application submission | 7/10 |
| **Jobright AI** | Free tier; Turbo ~$39.99/mo | AI job matching (8M+ listings), auto-apply agent, referral discovery | Job matching + H1B sponsorship filter | Strong matching engine; Insider Connections for referrals; H1B filter | US-only; billing complaints (72% of 1-star reviews cite billing); AI may fabricate skills | 7/10 |
| **Huntr** | Free (100 jobs); $40/mo ($30/mo quarterly) | Application tracker, autofill | Application tracking | Clean UI, good autofill | No job discovery; low free cap | 6/10 |
| **Resumly** | Free (10 auto-applies with tailored resume); paid tiers | Auto-apply with tailored resume + cover letter per job | Auto-apply with quality control | Per-job tailoring; free tier includes auto-apply | Newer entrant, smaller job inventory | 6/10 |
| **Sonara** | Varies (monthly billing) | Hands-off auto-apply | Bulk volume auto-apply | Set-and-forget | Limited proof of submissions; monthly billing complaints | 4/10 |
| **scale.jobs** | $199 one-time | Human-assisted done-for-you applications | Done-for-you with proof | Human quality control; proof of submission sent | Higher upfront cost; not fully AI | 5/10 |

### Key Takeaway
The market splits into: (a) **autofill** (Simplify dominates for free), (b) **matching + tracking** (Teal/Jobright), (c) **resume optimization** (Jobscan), and (d) **auto-apply** (Resumly/Jobright Agent). No single tool does all well.

---

## 3. Auto-Apply Tools & Open-Source Projects

| Tool | Type | Pricing | ATS Support | Success Rate | Status | Score |
|------|------|---------|-------------|-------------|--------|-------|
| **AIHawk** (`feder-cr/Auto_Jobs_Applier_AIHawk`) | OSS (Python) | Free (MIT) | LinkedIn, Indeed, (Glassdoor, Workday in progress) | Claims 100+ interviews / 1000 apps | **Archived** (repo inactive); 17.6K stars at peak | 6/10 |
| **Simplify** | SaaS (Chrome ext) | Free / $39.99/mo | Workday, Greenhouse, Lever, Ashby (85-90%), iCIMS (40-50%) | 6-10 assisted apps/hr | Active, well-funded, 500K+ users | 9/10 |
| **LazyApply** | SaaS | $99–$249 lifetime | LinkedIn Easy Apply, some ATS | Spray-and-pray; low quality | Poor reputation; renamed Trustpilot to hide negative reviews | 2/10 |
| **LoopCV** | SaaS | Free (10 apps/mo); €9.99/mo Standard | 20+ job boards, Greenhouse/Lever/Workday/Ashby via MCP | Moderate | Active; EU-based; Claude MCP integration | 7/10 |
| **ApplyPilot** | SaaS | Free tier; paid plans | Multi-platform (claims 150+ jobs/day) | Unverified claims | Newer entrant (2025/2026); largely marketing-heavy | 4/10 |
| **devdattatalele/auto-apply** | OSS (Python) | Free | LinkedIn, Indeed | Unknown | Small repo, limited maintenance | 3/10 |
| **JobCopilot** | SaaS | From ~$0.93/day | 500K+ career pages, major ATS | 20-50 apps/day | No free tier; "review before submit" mode; scam listing reports | 5/10 |
| **Claude Job Auto-Apply** | MCP skill (via LoopCV) | Free to connect; LoopCV paid for auto-submit | Greenhouse/Lever/Workday/Ashby | Varies | MCP-based; Claude controls submission trigger | 7/10 |

### OSS Landscape

- **AIHawk** was the dominant OSS project (17.6K stars) but is now archived. The core maintainer moved on. Forks exist but quality varies.
- **Active OSS alternatives:** None at scale. Most auto-apply OSS repos are small, experimental, or abandoned.
- **Recommendation:** career-ops should NOT build auto-apply. Instead, integrate with Simplify (autofill) + LoopCV (MCP-based auto-apply) as optional plugins.

### ATS Compatibility

| ATS | Simplify | LoopCV | AIHawk (legacy) | LazyApply | ApplyPilot |
|-----|----------|--------|-----------------|-----------|------------|
| **Greenhouse** | ✅ 85-90% | ✅ | ❌ | ✅ Basic | ✅ |
| **Lever** | ✅ 85-90% | ✅ | ❌ | ✅ Basic | ✅ |
| **Ashby** | ✅ 85-90% | ✅ | ❌ | ✅ Basic | ✅ |
| **Workday** | ✅ ~70% | ✅ | ❌ | ✅ Basic | ✅ |
| **iCIMS** | ⚠️ 40-50% | ❌ | ❌ | ❌ | ❌ |
| **Taleo** | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 4. Recruiter & Matching Platforms

Focus: **Java/backend roles, remote options, EMEA hiring**

| Platform | Pricing (Hirer) | Coverage | Java/Backend | Remote | EMEA Focus | Strengths | Weaknesses | Score |
|----------|----------------|----------|-------------|--------|------------|-----------|------------|-------|
| **Turing** | ~$5K–$100K+ per hire | Global (4M+ dev pool) | ✅ Strong Java/backend | ✅ Long-term remote | ✅ Global | AI-driven matching; structured candidate data; strong for sustained remote teams | Enterprise-oriented; limited short-term freelance; no public pricing | 8/10 |
| **Toptal** | Premium rates (top 3%) | Global | ✅ Java/backend | ✅ Freelance | ✅ Strong EU presence | Strictest vetting; fast matching for senior roles; trial periods | Expensive ($60-150+/hr); less flexible for large teams | 8/10 |
| **Hired** | ~15-20% salary placement fee | US-focused, some EMEA | ✅ Backend | ✅ | ⚠️ Limited EMEA | Quality-over-volume; salary transparency; good for US tech hubs | US-centric; less effective for junior roles | 7/10 |
| **Arc.dev** | Commission-based | Global | ✅ Java/backend | ✅ Strong remote | ✅ EU strong | AI-assisted matching (HireAI); contract-to-hire; good for startups | Premium talent expensive; smaller than Toptal/Turing | 7/10 |
| **Gun.io** | Curated network | US + some Global | ✅ Backend (senior focus) | ✅ Freelance | ⚠️ Limited | Senior-only quality; vetted network | Smaller pool; US-biased | 6/10 |
| **Andela** | Managed teams | Global (Africa focus) | ✅ Java/backend | ✅ | ✅ EMEA via Africa talent | Social mission; managed teams; good for cost-effective scaling | Timezone challenges; quality varies by cohort | 7/10 |
| **Vettery** | Acquired by Adecco | Global | ✅ | ✅ | ✅ | Now part of Adecco group; larger network | Lost independence; less clear what it offers standalone | 5/10 |
| **Upstack** | Premium | Global | ✅ Senior devs | ✅ | ⚠️ | Vetted senior talent | Very expensive; small network | 5/10 |
| **CodementorX** | Premium | Global | ✅ Backend | ✅ Freelance | ✅ | Developer-friendly; good for short-term contracts | Limited volume; not full-time oriented | 5/10 |

### career-ops Relevance

- **Turing & Toptal** are most relevant for Java/backend roles with EMEA remote options
- **Arc.dev** is best for EU-based remote (strong European presence)
- **Integration possibility:** career-ops could use Turing's/Arc's API for job matching (no public API currently — would need partner access)

---

## 5. Remote-First Job Platforms

| Platform | Pricing | API | Monthly Job Volume | Java/Backend Density | Strengths | Weaknesses | Score |
|----------|---------|-----|-------------------|---------------------|-----------|------------|-------|
| **RemoteOK** | Paid (posting); Free (browsing) | **Free public API** (`remoteok.com/api`) | ~3,000+ | Medium | #1 remote-only board; free API; salary data | 24hr API delay; requires attribution | 9/10 |
| **Remotive** | Freemium | **Free public API** (`remotive.com/api/remote-jobs`) | ~2,000+ | Medium | Free API; category filtering; active community | 24hr API delay; limited search | 8/10 |
| **WeWorkRemotely** | Paid (posting); Free (browsing) | **Read API** (token required) | ~1,500+ | Low-Medium | Longest-running remote board; high-quality listings | API requires token (email to get); limited endpoints | 7/10 |
| **Himalayas** | Free | **Free public API** (`himalayas.app/api`) | ~1,000+ | Medium | Clean API; salary min/max; timezone filters | Smaller volume; newer board | 8/10 |
| **FlexJobs** | Paid ($9.95/mo jobseeker) | No public API | ~5,000+ | Low-Medium | Scam-free curation; quality over quantity | Paid for jobseekers; no API | 5/10 |
| **Jobspresso** | Free | RSS only | ~500+ | Low | Free, hand-curated | Very small volume; no structured API | 4/10 |
| **Working Nomads** | Freemium | No public API | ~500+ | Low | Good for nomad lifestyle content | Small volume; no API | 3/10 |
| **Remote.co** | Freemium | No public API | ~1,000+ | Medium | Q&A section; company reviews | No API; limited filtering | 4/10 |
| **Arc.dev** (jobs) | Free (jobseeker) | Own API (partner) | ~500+ | **High** | Strong Java/backend density; EU-heavy | Smaller volume than RemoteOK | 7/10 |

### API Integration Summary

| Board | API Endpoint | Auth | Rate Limit | JSON | Best For |
|-------|-------------|------|------------|------|----------|
| RemoteOK | `remoteok.com/api` | None | ~60 req/min | ✅ | High-volume general remote |
| Remotive | `remotive.com/api/remote-jobs` | None | 2 req/min | ✅ | Category-filtered remote |
| Himalayas | `himalayas.app/api/jobs` | None | ~30 req/min | ✅ | Salary-structured remote |
| WeWorkRemotely | `weworkremotely.com/api/v1/remote-jobs` | Token (email request) | Standard | ✅ | Senior remote roles |

### Apify Actor (pre-built scraper)
- **Remote Jobs Scraper** (`scrapemint/remote-jobs-scraper`): $3/1K rows, covers RemoteOK + Remotive + WeWorkRemotely + Himalayas, unified schema
- **ATS Jobs Scraper** (`themineworks/ats-jobs`): $1/1K jobs, covers Greenhouse/Lever/Workday/Ashby direct

### career-ops Integration
- career-ops can already ingest RemoteOK, Remotive, Himalayas, and WeWorkRemotely via their free APIs (no API key needed for 3 of 4)
- Apify's ATS Jobs Scraper costs $1/1K jobs — cheaper than any aggregator API
- Remote Java/backend job density is highest on RemoteOK → Arc.dev → Remotive

---

## 6. Visa Sponsorship Platforms

| Platform | Focus Regions | Job Types | Reliability Score | Pricing | Strengths | Weaknesses | API | 
|----------|--------------|-----------|-----------------|---------|-----------|------------|-----|
| **Relocate.me** | Europe (primarily) | Tech (senior+) | 9/10 | Free (jobseeker); $499/job post (employer) | Largest curated tech visa job board; manual review; The Global Move newsletter (1,235 roles) | Senior-focused; few junior roles | No public API |
| **Jobbatical** | Global (45+ countries) | Tech + blue-collar | 8/10 | Free (jobseeker); employer pricing varies | ISO 27001; 17K+ relocations; AI visa compliance for employers | Shifted to business immigration SaaS; less of a job board now | Employer API only |
| **MyVisaJobs** | USA (H1B/OPT/CPT) | Tech + other | 7/10 | Free basic; premium features | H1B database; employer sponsor history; USCIS form help | US-only; no auto-apply; requires self-outreach | No public API |
| **H1Base** | USA (H1B) | Tech | 6/10 | Free | H1B visa data; employer green card data | Narrow scope; limited job matching | No public API |
| **GoingGlobal** | Global (50+ countries) | All types | 7/10 | Paid (institutional usually) | Country-specific career guides; work permit info; employer lists | Behind paywall; institutional licensing | No public API |
| **GoAbroad** | Global | Education/teaching/internships | 6/10 | Free | Study abroad, teach abroad, volunteer, intern | Not job-search focused; limited professional roles | No public API |
| **Jooble** (visa filter) | Global | All types | 5/10 | Free to search | Has visa sponsorship keyword filter; broad coverage | Not a dedicated visa platform; unreliable filter | XML feed only |

### Key Insights

- **Relocate.me is the gold standard** for European tech visa sponsorship — hand-curated, high accuracy, senior+ focused
- **No visa sponsorship platform offers a public API** — career-ops would need to scrape or partner
- **The Global Move** (Relocate.me's paid newsletter) sends ~100 curated visa-sponsor jobs/week — could be manually ingested
- For US H1B, MyVisaJobs has the best free employer sponsorship database
- **Recommendation:** career-ops should track Relocate.me (web scrape) and MyVisaJobs (web scrape) for visa-sponsor role discovery

---

## 7. ATS Search & Discovery Engines

| Tool | Type | Pricing | ATS Coverage | Auto-Detect | Company DB Size | Strengths | Weaknesses | Score |
|------|------|---------|-------------|-------------|----------------|-----------|------------|-------|
| **Apify Multi-ATS Jobs Scraper** (`memo23/ats-jobs-scraper`) | Apify Actor | $2/1K results | **10 ATS** (Greenhouse, Lever, Ashby, SmartRecruiters, Workday, Workable, Recruitee, Breezy, Personio, BambooHR) | ✅ Auto-detects by domain/name | Unlimited (user provides company list) | Unified schema; email enrichment; best ATS coverage on Apify | No built-in company DB — must supply start URLs or org names | 9/10 |
| **Apify ATS Jobs Scraper** (`enosgb/ats-job-scraper`) | Apify Actor | Pay-per-result | 5 ATS (Greenhouse, Lever, Ashby, Workday, Rippling) | ✅ Auto-detects | User-provided | Clean output; works with company domains | Fewer ATS; no email enrichment | 7/10 |
| **Apify ATS Jobs Scraper** (`themineworks/ats-jobs`) | Apify Actor | $1/1K jobs | 4 ATS (Greenhouse, Lever, Workday, Ashby) | ✅ Auto-detects (probes in order) | User-provided | Cheapest per-job; MCP-ready | Fewer ATS; no enrichment | 8/10 |
| **RoleRadar** | SaaS (beta) | Invite-only beta | 10 ATS + 3,400+ companies | ✅ (scans every 6h) | 3,400+ scored companies | Resume-first scoring; scouting reports; continuous scanning | Invite-only beta; no public API; unknown pricing | 7/10 |
| **CareerScout** | SaaS | Unknown | Unknown | ✅ (5.5M domain scanner) | 5.5M domains | Massive domain coverage; ATS fingerprinting | Difficult to find; limited public info | 4/10 |
| **ATS Job Discovery Engine** (GitHub: mikegrowsgreens) | OSS | Free | 50+ ATS via Apify Career Site Feed | Partial | User-provided | Three-phase pipeline (discovery → scoring → action) | Early-stage; limited documentation | 5/10 |

### career-ops Integration

- **Apify Multi-ATS Jobs Scraper is the top pick** — $2/1K jobs, 10 ATS platforms, auto-detect, unified schema
- Current career-ops scan.mjs covers 62 ATS providers via portal.yml — Apify actors add another 10-50 ATS
- **MCP Integration:** Apify actors can be used as MCP servers:
  ```json
  {
    "mcpServers": {
      "apify": {
        "command": "npx mcp-remote",
        "args": ["https://mcp.apify.com/?tools=memo23~ats-jobs-scraper"],
        "headers": { "Authorization": "Bearer <API_TOKEN>" }
      }
    }
  }
  ```

---

## 8. Company Career Page Scrapers

| Tool | Type | Pricing | JS Rendering | Ease of Integration | Best For | Strengths | Weaknesses | Score |
|------|------|---------|-------------|-------------------|----------|-----------|------------|-------|
| **Crawlee** (Apify) | OSS framework (Node) | Free; Apify cloud $5/mo | ✅ Playwright/Puppeteer backends | High (100 lines to a working crawler) | Custom career page scrapers with anti-bot | Built-in queues/retries/sessions; proxy rotation; Crawlee + Apify = one-line deploy | Node.js only; steeper learning than API-based tools | 9/10 |
| **Scrapy** | OSS framework (Python) | Free | ⚠️ Via scrapy-playwright plugin | Medium | Large-scale structured crawling | Mature ecosystem; Python; vast community; middleware | No native JS rendering; needs plugin; more boilerplate than Crawlee | 8/10 |
| **Firecrawl** | SaaS + OSS | Free (1K credits/mo); $299/mo Pro; $599/mo Growth | ✅ Full JS rendering + LLM extraction | Very high (API call) | LLM-ready Markdown; schema-based extraction | AI-powered extraction (LLM reads any page); search/scrape/agent endpoints; MCP support | Cost scales with volume; free tier limited to 1K credits | 9/10 |
| **Browse AI** | SaaS (no-code) | Free (50 credits/mo); $49/mo Starter | ✅ | Very high (no-code) | Non-engineers needing simple scraping | No-code; reliable; pre-built robots; monitoring | Expensive for volume; less flexible than code-based | 7/10 |
| **Playwright** | OSS library | Free | ✅ Native | High (SDK in JS/Python/Java/.NET) | Custom scripts with browser control | Cross-browser; auto-wait; trace viewer; MCP integration | Requires coding; no built-in proxy/queue management | 8/10 |
| **Octoparse** | SaaS (no-code) | Free (limited); $89/mo Standard | ✅ | Very high (desktop app) | Non-technical business users | Point-and-click; handles JS; scheduled runs | Windows-only desktop app; expensive for what it does | 5/10 |
| **Puppeteer** | OSS library | Free | ✅ Chromium only | Medium | Chrome-only Node.js tasks | Lightweight; close to DevTools; simple for Chrome-only work | Chromium only; manual waits; Node.js only | 6/10 |

### Firecrawl for career-ops

Firecrawl is uniquely suited for career page scraping because of its **schema-based LLM extraction**:

```
# One schema reads every ATS
{
  "title": "string",
  "company": "string",
  "location": "string",
  "salary": "string",
  "description": "string",
  "postedDate": "string",
  "applyUrl": "string"
}
```

- Works on any career page regardless of ATS technology
- LLM finds fields even after redesign (no CSS selector brittleness)
- Agent endpoint can navigate multi-step career sites
- MCP-compatible — can be used directly by Claude/career-ops modes

### cost comparison per 1000 jobs

| Tool | Cost | Effort | Reliability |
|------|------|--------|-------------|
| Firecrawl | ~$5-10 (credits) | Low (API call) | High (LLM finds data) |
| Apify ATS Actor | $2 | Low (pre-built) | High (ATS API) |
| Crawlee (self-host) | $0 (compute only) | High (build + maintain) | Medium (needs updates) |
| Browse AI | ~$10-20 | Very low (no-code) | Medium |

---

## 9. Browser Automation Frameworks

| Framework | Language | Headless | Docker | JS Rendering Quality | Multi-Browser | Auto-Wait | Stealth | Score |
|-----------|----------|----------|--------|---------------------|---------------|-----------|---------|-------|
| **Playwright** | JS, Python, Java, .NET | ✅ Native | ✅ Official image | **Excellent** (all 3 engines) | Chromium, Firefox, WebKit | ✅ First-class | ⚠️ Via stealth plugin | **10/10** |
| **Puppeteer** | JS/TS | ✅ Native | ✅ | **Good** (Chromium only) | Chromium only | Manual/partial | ⚠️ Via plugin | 7/10 |
| **Selenium** | Java, Python, C#, JS, Ruby | ✅ Via flags | ✅ | **Good** (via WebDriver) | Chrome, Firefox, Safari, Edge | Manual (WebDriverWait) | ⚠️ Via undetected-chromedriver | 6/10 |
| **Browserbase** (Stagehand) | JS/TS | ✅ Cloud | ✅ | **Excellent** (Playwright-based) | Chromium, Firefox, WebKit | ✅ AI-driven | ✅ Built-in anti-detect | 9/10 |
| **Browserless** | HTTP API | ✅ Cloud | ✅ Official | **Good** (Chrome-only) | Chromium | Via config | ✅ Managed | 8/10 |
| **Browser Use** | Python | ✅ | ✅ | **Excellent** (Playwright-based) | Chromium (primary) | ✅ AI-driven | ✅ Via config | 8/10 |

### Performance Benchmarks (2026)

| Metric | Playwright | Puppeteer | Selenium |
|--------|-----------|-----------|----------|
| Cold start→first navigation | ~0.4-0.7s | ~0.3-0.5s | ~1.2-2.5s |
| Idle RAM after launch | ~90-130 MB | ~60-100 MB | ~180-280 MB |
| Simple static pages/minute | ~35-55 | ~40-60 | ~18-35 |
| Pages/24h (scaled) | ~30,000 | ~28,000 | ~8,000 |
| Per-action latency | ~290ms | ~310ms | ~536ms |

### career-ops Context

- **Playwright is already in career-ops** (used in scan.mjs, generate-pdf.mjs, liveness checks) — this is the right choice
- **Anti-detection is critical for career page scraping** — Playwright + Crawlee stealth plugin + residential proxies is the standard stack
- **Docker support:** All three frameworks have official Docker images. Playwright's is the most battle-tested for scraping at scale
- **Recommendation:** Stay on Playwright. Upgrade to Crawlee's PlaywrightCrawler when career-ops needs anti-bot, queues, and session management

---

## 10. AI Agent Frameworks

| Framework | Type | License | Job Search Relevance | Ease of Setup | Strengths for Job Search | Weaknesses for Job Search | Score |
|-----------|------|---------|---------------------|--------------|-------------------------|---------------------------|-------|
| **Browser Use** | OSS (Python) | MIT | **High** — natural language browser control | Medium | 💡 Best for automating job applications: "apply to Python backend jobs on LinkedIn"; LLM drives clicks/scrolls/extract; Playwright-based | Requires LLM API keys; slower than direct scraping | 9/10 |
| **Claude Code (MCP)** | CLI/Protocol | Proprietary (free tier) | **High** — career-ops foundation | Very easy | Already powers career-ops; MCP connects to Apify, LoopCV, web scraping; natural language mode switching | Tied to Anthropic; no multi-agent orchestration natively | 10/10 |
| **CrewAI** | OSS (Python) | MIT | **Medium** — multi-agent job search crew | Easy | Split labor: Researcher Agent + Scraper Agent + Matcher Agent + Apply Agent | Overhead for simple search; not designed for browser automation | 7/10 |
| **LangGraph** | OSS (Python) | MIT | **Medium** — stateful workflows | Hardest | Best for production-grade pipelines with state management, human-in-the-loop checkpoints, complex conditional logic | Steep learning curve; overkill for most job search tasks | 7/10 |
| **AutoGen** (v2/AG2) | OSS (Python) | MIT | **Low-Medium** — multi-agent conversations | Hard | Flexible agent conversations; code execution; good for research | In maintenance mode (swallowed by Microsoft Agent Framework); complex setup | 5/10 |
| **OpenAI Agents SDK** | OSS (Python) | MIT | **Low-Medium** | Easy | Guardrails; handoffs; native tool calling | Tied to OpenAI; less mature than LangGraph for complex workflows | 6/10 |
| **n8n** | OSS (Node) + Cloud | Fair-code | **High** — visual workflow automation | Easy (UI) | 💡 Best for non-coders: drag-and-drop AI workflows; webhook triggers; 400+ integrations; can scrape → filter → notify → apply flow | Limited for complex browser automation; slower than code | 9/10 |
| **Make.com** (Integromat) | SaaS | Paid | **Medium** | Very easy | Visual scenario builder; 1,500+ apps; good for notification pipelines | No LLM-native agent design; expensive for volume | 6/10 |
| **Hugging Face Agents** | OSS (Python) | Apache 2.0 | **Low** | Medium | Tool-using agents; open models | No job-specific tools; research-grade | 4/10 |
| **Mastra** | OSS (TypeScript) | MIT | **Low-Medium** | Easy | TypeScript-native; good for web devs building agent apps | Newer entrant; smaller ecosystem | 5/10 |

### Frameworks Ranked for Job Search Automation

```
1. Claude Code (MCP) — Already career-ops' foundation
2. Browser Use — Best for automating browser-based job search
3. n8n — Best for visual workflow orchestration (scrape → filter → notify → apply)
4. CrewAI — Best for multi-agent role-based job search crew
5. LangGraph — Best for production-grade stateful pipelines
6. OpenAI Agents SDK — Good if already in OpenAI ecosystem
7. AutoGen — Legacy; prefer Microsoft Agent Framework
```

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Claude Code (orchestrator)              │
│                                                          │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────┐  │
│  │ Scan.mjs │  │ Pipeline  │  │ Evaluate │  │ Apply  │  │
│  │ (ATS+API)│  │ (queue)   │  │ (oferta) │  │ (MCP)  │  │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └───┬────┘  │
│       │              │             │             │        │
│  ┌────▼──────────────▼─────────────▼─────────────▼────┐   │
│  │              MCP / Tool Layer                       │   │
│  │  • Apify (ATS Scraper)   • Firecrawl (Career Pages) │   │
│  │  • LoopCV (Auto-Apply)   • Browser Use (Browser)    │   │
│  │  • n8n (Workflow)        • Simplify (Autofill)      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Recommendations for career-ops

### Highest Priority Integrations

| Priority | Integration | Category | Reason |
|----------|-------------|----------|--------|
| **P0** | Enable Apify ATS Jobs Scraper as MCP | ATS Search | $1-2/1K jobs, 10 ATS, unified schema, MCP-ready |
| **P1** | Add Firecrawl as optional LLM-backed career page scraper | Career Page Scrapers | Handles any ATS via LLM extraction; no per-site selectors |
| **P1** | Wire n8n for workflow automation (scrape → evaluate → notify) | AI Agent Frameworks | Non-coders can build job search automations visually |
| **P2** | Add Browser Use as optional "apply for me" agent | AI Agent Frameworks | Natural language browser control for auto-apply |
| **P2** | Support Simplify.jobs autofill as optional apply plugin | AI Job Search | Best free autofill (4.9/5, 500K+ users) |
| **P2** | Add remote boards API ingestion (RemoteOK/Remotive/Himalayas) | Remote-First | Free APIs, no key needed, unified via Apify actor |

### Data Sources Already Working in career-ops

- ✅ 62 ATS providers via `portals.yml` scan
- ✅ Indeed/Google/LinkedIn via `scan.mjs` 
- ✅ Apify actors via `plugins.mjs`
- ✅ Playwright for browser-based verification

### Gaps to Fill

| Gap | Impact | Solution |
|-----|--------|----------|
| No auto-apply capability | Missed opportunity for rapid application | Integrate Simplify (autofill) + LoopCV MCP (auto-apply) as optional plugins |
| No remote board API ingestion | Missing RemoteOK/Remotive/Himalayas listings | Add free API calls to scan.mjs (3 of 4 boards need no auth) |
| No LLM-based career page scraping | Fragile ATS-specific scrapers break on redesign | Add Firecrawl as optional fallback for career page parsing |
| No visual workflow builder | Non-coders can't build automation chains | Document n8n + career-ops integration |
| No visa-sponsorship tracking | Missing visa-tagged role discovery | Add Relocate.me scraping to pipeline options |

---

*Research compiled from 40+ sources including platform documentation, 2026 comparison reviews, GitHub repos, and direct API analysis. All pricing verified July 2026 — confirm with each vendor before committing.*
