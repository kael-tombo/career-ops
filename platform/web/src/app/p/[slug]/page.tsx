'use client';
import { useEffect, useState } from 'react';
import styles from './portfolio.module.css';

interface Portfolio {
  title: string;
  cvContent: string;
  starStories: { title: string; requirement: string; star: string }[];
}

export default function PublicPortfolioPage({ params }: { params: { slug: string } }) {
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/public/portfolio/${params.slug}`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.slug]);

  if (loading) return <div className={styles.container}>Loading portfolio...</div>;
  if (!data) return <div className={styles.container}>Portfolio not found.</div>;

  return (
    <div className={styles.portfolioPage}>
      <header className={styles.header}>
        <h1 className={styles.title}>{data.title}</h1>
        <div className={styles.badge}>Evidence-Based Application</div>
      </header>

      <main className={styles.main}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Master Profile</h2>
          <div className={styles.cvContent}>
            {data.cvContent.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Relevant Experience (STAR Stories)</h2>
          <div className={styles.stories}>
            {data.starStories?.map((story, i) => (
              <div key={i} className={styles.storyCard}>
                <h3 className={styles.storyTitle}>{story.title}</h3>
                <p className={styles.storyReq}><strong>Requirement:</strong> {story.requirement}</p>
                <p className={styles.storyText}>{story.star}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        Powered by <span className={styles.logo}>career-ops</span>
      </footer>
    </div>
  );
}
