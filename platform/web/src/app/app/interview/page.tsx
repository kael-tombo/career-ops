import styles from '../shared.module.css';

export default function InterviewPrepPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Interview Prep & Story Bank</h1>
          <p className={styles.subtitle}>Accumulated behavioral answers and system design templates.</p>
        </div>
      </div>
      
      <div className={styles.grid}>
        <div className={`${styles.card} card`}>
          <h2>STAR Stories</h2>
          <p className={styles.muted}>Your generated behavioral stories linked to your top CV assets.</p>
          <div className={styles.list}>
             <div className={styles.listItem}>
               <strong>Ambatovy IMS Migration</strong>
               <span className="badge badge-surface">System Reliability</span>
             </div>
             <div className={styles.listItem}>
               <strong>DDS.mg SaaS Delivery</strong>
               <span className="badge badge-surface">DevOps / CI-CD</span>
             </div>
          </div>
        </div>
        
        <div className={`${styles.card} card`}>
          <h2>Negotiation Scripts</h2>
          <p className={styles.muted}>Templates for geographic discount pushbacks and competing offer leverage.</p>
          <div className={styles.list}>
             <div className={styles.listItem}>
               <strong>Remote-First Top Tier Competing</strong>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
