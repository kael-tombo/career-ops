import styles from './page.module.css';

export default function LandingPage() {
  return (
    <div className={styles.root}>
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <span className={styles.logo}>
            career<span className={styles.logoAccent}>-ops</span>
            <span className={styles.logoBadge}>cloud</span>
          </span>
          <div className={styles.navLinks}>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="https://github.com/santifer/career-ops" target="_blank" rel="noreferrer">Open Source</a>
          </div>
          <div className={styles.navCta}>
            <a href="/sign-in" className="btn btn-ghost btn-sm">Sign in</a>
            <a href="/sign-up" className="btn btn-primary btn-sm">Get started free</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden />
        <div className={styles.heroContent}>
          <div className={`badge badge-blue ${styles.heroPill}`}>
            <span className={styles.heroPillDot} />
            740+ offers evaluated · 1 dream role landed
          </div>

          <h1 className={styles.heroTitle}>
            Stop applying<br />
            <span className={styles.heroGradient}>Start choosing</span>
          </h1>

          <p className={styles.heroSub}>
            AI scans 45+ company portals daily, scores every offer A–F,<br />
            and generates a tailored CV before you've had your morning coffee.
          </p>

          <div className={styles.heroCtas}>
            <a href="/sign-up" className="btn btn-primary btn-lg" id="hero-cta-signup">
              Start for free
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <a href="https://github.com/santifer/career-ops" className="btn btn-ghost btn-lg" id="hero-cta-github" target="_blank" rel="noreferrer">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              View on GitHub
            </a>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.heroStat}><span className={styles.heroStatNum}>740+</span><span>Offers evaluated</span></div>
            <div className={styles.heroStatDivider}/>
            <div className={styles.heroStat}><span className={styles.heroStatNum}>100+</span><span>Tailored CVs</span></div>
            <div className={styles.heroStatDivider}/>
            <div className={styles.heroStat}><span className={styles.heroStatNum}>45+</span><span>Portals scanned</span></div>
            <div className={styles.heroStatDivider}/>
            <div className={styles.heroStat}><span className={styles.heroStatNum}>A–F</span><span>Every offer scored</span></div>
          </div>
        </div>

        {/* ── Hero Dashboard Preview ──────────────────────────────────── */}
        <div className={styles.heroPreview}>
          <div className={`${styles.previewCard} card glass`}>
            <div className={styles.previewHeader}>
              <div className={styles.previewDots}>
                <span style={{background:'var(--ctp-red)'}}/>
                <span style={{background:'var(--ctp-yellow)'}}/>
                <span style={{background:'var(--ctp-green)'}}/>
              </div>
              <span className={styles.previewTitle}>Pipeline Dashboard</span>
            </div>
            <div className={styles.previewRows}>
              {[
                { company: 'Anthropic', role: 'Senior Backend Eng', score: 4.8, status: 'Interview', color: 'green' },
                { company: 'Mistral AI', role: 'Platform Engineer', score: 4.2, status: 'Applied', color: 'blue' },
                { company: 'ElevenLabs', role: 'Full-Stack Eng', score: 3.9, status: 'Evaluated', color: 'mauve' },
                { company: 'Retool', role: 'Backend Engineer', score: 4.5, status: 'Evaluated', color: 'blue' },
                { company: 'n8n', role: 'Java Architect', score: 3.6, status: 'SKIP', color: 'red' },
              ].map((r) => (
                <div key={r.company} className={styles.previewRow}>
                  <span className={styles.previewCompany}>{r.company}</span>
                  <span className={styles.previewRole}>{r.role}</span>
                  <span className={styles.previewScore}>{r.score}</span>
                  <span className={`badge badge-${r.color}`}>{r.status}</span>
                </div>
              ))}
            </div>
            <div className={styles.previewFooter}>
              <div className={styles.previewScanBadge}>
                <span className={styles.previewPulse}/>
                Scanning 45 portals...
              </div>
              <span className={styles.previewFaint}>2 new matches found</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className={styles.features} id="features">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Features</div>
          <h2 className={styles.sectionTitle}>Everything your job search needs</h2>
          <p className={styles.sectionSub}>Built by someone who used it to evaluate 740+ offers and land a Head of Applied AI role.</p>

          <div className={styles.featureGrid}>
            {[
              {
                icon: '🔍',
                title: 'Daily Portal Scan',
                desc: 'Auto-scans Greenhouse, Ashby, Lever, and 40+ company career pages every day. New matches go straight into your pipeline.',
                badge: 'Pro',
              },
              {
                icon: '🤖',
                title: 'AI Offer Evaluation',
                desc: 'Each offer gets a structured A–F score across 10 dimensions: role match, comp research, culture fit, interview strategy, and more.',
                badge: null,
              },
              {
                icon: '📄',
                title: 'ATS-Optimized CVs',
                desc: 'Generates a tailored, keyword-injected PDF for each application. Uses your CV + proof points + the JD to maximize ATS pass-through.',
                badge: 'Pro',
              },
              {
                icon: '🎯',
                title: 'Interview Prep',
                desc: 'STAR+R story bank that accumulates across evaluations. Company-specific intel, culture signals, and behavioral question frameworks.',
                badge: null,
              },
              {
                icon: '📊',
                title: 'Pipeline Dashboard',
                desc: 'Kanban board with 6 status columns. Sort, filter, search. Full evaluation report on click. Track every application in one place.',
                badge: null,
              },
              {
                icon: '🎤',
                title: 'Negotiation Coach',
                desc: 'Salary benchmarking, geographic discount pushback scripts, competing offer leverage templates. Never leave money on the table.',
                badge: 'Elite',
              },
            ].map((f) => (
              <div key={f.title} className={`${styles.featureCard} card`}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <div className={styles.featureTop}>
                  <h3 className={styles.featureTitle}>{f.title}</h3>
                  {f.badge && <span className={`badge badge-${f.badge === 'Elite' ? 'mauve' : 'blue'}`}>{f.badge}</span>}
                </div>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section className={styles.pricing} id="pricing">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Pricing</div>
          <h2 className={styles.sectionTitle}>Invest in finding the right role</h2>
          <p className={styles.sectionSub}>Landing one good offer pays for years of subscription.</p>

          <div className={styles.pricingGrid}>
            {[
              {
                plan: 'Free',
                price: '$0',
                period: 'forever',
                desc: 'Try it out',
                color: 'surface',
                features: ['5 AI evaluations / month', 'Manual portal scan', 'Pipeline tracker', 'Basic interview prep'],
                cta: 'Get started',
                ctaHref: '/sign-up',
                featured: false,
              },
              {
                plan: 'Pro',
                price: '$19',
                period: '/ month',
                desc: 'For active job seekers',
                color: 'blue',
                features: ['Unlimited AI evaluations', 'Daily auto-scan (45+ portals)', 'ATS PDF generation', 'Interview story bank', 'Full evaluation reports', 'Email notifications'],
                cta: 'Start Pro',
                ctaHref: '/sign-up?plan=pro',
                featured: true,
              },
              {
                plan: 'Elite',
                price: '$49',
                period: '/ month',
                desc: 'Maximum leverage',
                color: 'mauve',
                features: ['Everything in Pro', 'Batch processing', 'LinkedIn outreach drafts', 'Negotiation coach', 'Priority AI (faster evals)', 'Rejection pattern analysis'],
                cta: 'Go Elite',
                ctaHref: '/sign-up?plan=elite',
                featured: false,
              },
            ].map((p) => (
              <div key={p.plan} className={`${styles.pricingCard} card ${p.featured ? styles.pricingFeatured : ''}`}>
                {p.featured && <div className={styles.pricingBadge}>Most Popular</div>}
                <div className={styles.pricingTop}>
                  <span className={`badge badge-${p.color}`}>{p.plan}</span>
                  <p className={styles.pricingDesc}>{p.desc}</p>
                </div>
                <div className={styles.pricingPrice}>
                  <span className={styles.pricingAmount}>{p.price}</span>
                  <span className={styles.pricingPeriod}>{p.period}</span>
                </div>
                <ul className={styles.pricingFeatures}>
                  {p.features.map((f) => (
                    <li key={f}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7l3.5 3.5L12 3" stroke="var(--ctp-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href={p.ctaHref} id={`pricing-cta-${p.plan.toLowerCase()}`}
                  className={`btn ${p.featured ? 'btn-primary' : 'btn-ghost'} ${styles.pricingCta}`}>
                  {p.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.logo}>
            career<span className={styles.logoAccent}>-ops</span>
            <span className={styles.logoBadge}>cloud</span>
          </span>
          <p className={styles.footerText}>
            Built on the open-source <a href="https://github.com/santifer/career-ops" target="_blank" rel="noreferrer" style={{color:'var(--ctp-blue)'}}>career-ops</a> system by <a href="https://santifer.io" target="_blank" rel="noreferrer" style={{color:'var(--ctp-blue)'}}>santifer</a>.
          </p>
          <p className={styles.footerText} style={{color:'var(--ctp-overlay0)', fontSize: '12px', marginTop: '8px'}}>
            Human-in-the-loop always. We never submit an application on your behalf.
          </p>
        </div>
      </footer>
    </div>
  );
}
