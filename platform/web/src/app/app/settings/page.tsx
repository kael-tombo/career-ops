import styles from '../shared.module.css';

export default function SettingsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Manage your profile, integrations, and subscription.</p>
        </div>
      </div>

      <div className={`${styles.section} card`}>
        <h2>AI Integrations</h2>
        <div className={styles.formGroup}>
          <label className={styles.label}>Anthropic API Key</label>
          <input type="password" className="input" placeholder="sk-ant-api03-..." defaultValue="sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXXXXXX" />
          <p className={styles.helpText}>Required for custom evaluations if on Free Tier.</p>
        </div>
        <button className="btn btn-primary btn-sm">Save Configuration</button>
      </div>
      
      <div className={`${styles.section} card`}>
        <h2>Subscription</h2>
        <div className={styles.planInfo}>
          Você está no plano <span className="badge badge-blue">Free</span>
        </div>
        <a href="/pricing" className="btn btn-primary btn-sm">Upgrade Plan</a>
      </div>
    </div>
  );
}
