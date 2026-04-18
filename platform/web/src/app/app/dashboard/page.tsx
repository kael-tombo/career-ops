'use client';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import styles from './page.module.css';
import { useApi, fetchApi } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';

const STATUS_COLOR: Record<string, string> = {
  Interview: 'green',
  Applied: 'blue',
  Evaluated: 'mauve',
  Offer: 'peach',
  Rejected: 'red',
  SKIP: 'red',
  Discarded: 'surface',
  Inbox: 'surface',
};

const COLUMNS = ['Inbox', 'Evaluated', 'Applied', 'Interview', 'Offer'];

interface Job {
  id: string;
  company: string;
  role: string;
  score: string | null;
  status: string;
  discoveredAt: string;
}

export default function DashboardPage() {
  const { data: jobs, error, isLoading, mutate } = useApi<Job[]>('/api/jobs');
  const { getToken } = useAuth();
  const [urlInput, setUrlInput] = useState('');
  const [localJobs, setLocalJobs] = useState<Job[]>([]);

  // Keep local state in sync with API
  useEffect(() => {
    if (jobs) setLocalJobs(jobs);
  }, [jobs]);

  const handleAddJob = async () => {
    if (!urlInput) return;
    try {
      await fetchApi('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ url: urlInput }),
      }, getToken);
      setUrlInput('');
      mutate();
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) return <div className={styles.page}>Loading pipeline...</div>;
  if (error) return <div className={styles.page}>Error loading pipeline.</div>;

  const activeJobs = localJobs || [];

  const byStatus = activeJobs.reduce<Record<string, Job[]>>((acc, job) => {
    const col = COLUMNS.includes(job.status) ? job.status : 'Evaluated';
    acc[col] = [...(acc[col] || []), job];
    return acc;
  }, {});

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceCol = result.source.droppableId;
    const destCol = result.destination.droppableId;
    if (sourceCol === destCol) return;

    const jobId = result.draggableId;
    
    // Optimistic update
    setLocalJobs((prev) => 
      prev.map(j => j.id === jobId ? { ...j, status: destCol } : j)
    );

    // Persist
    try {
      await fetchApi(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: destCol })
      }, getToken);
      mutate(); // Sync back with true server state
    } catch (err) {
      console.error('Failed to update status', err);
      mutate(); // Revert on failure
    }
  };

  const stats = [
    { label: 'Total Tracked', value: activeJobs.length, icon: '📁', color: 'blue' },
    { label: 'In Progress', value: activeJobs.filter(j => ['Applied','Interview'].includes(j.status)).length, icon: '🚀', color: 'green' },
    { label: 'Avg Score', value: activeJobs.length ? (activeJobs.reduce((s,j) => s + parseFloat(j.score||'0'), 0) / activeJobs.length).toFixed(1) : '0.0', icon: '⭐', color: 'mauve' },
    { label: 'New Today', value: 0, icon: '🔔', color: 'peach' },
  ];

  return (
    <div className={styles.page}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Pipeline</h1>
          <p className={styles.subtitle}>Track every opportunity across your job search</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-ghost btn-sm" id="btn-scan-portals">🔍 Scan Portals</button>
          <button className="btn btn-primary btn-sm" id="btn-add-job">+ Add Job</button>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <div className={styles.statsGrid}>
        {stats.map((s) => (
          <div key={s.label} className={`${styles.statCard} card`}>
            <div className={styles.statIcon}>{s.icon}</div>
            <div>
              <div className={`${styles.statValue} ${styles['color_' + s.color]}`}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Add Job Form ───────────────────────────────────────────────── */}
      <div className={`${styles.addForm} card`}>
        <span className={styles.addFormLabel}>Paste a job URL or description →</span>
        <input
          type="url"
          className={`input ${styles.addInput}`}
          placeholder="https://boards.greenhouse.io/anthropic/jobs/..."
          id="input-job-url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" id="btn-evaluate-url" onClick={handleAddJob}>Evaluate with AI</button>
      </div>

      {/* ── Kanban ────────────────────────────────────────────────────── */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className={styles.kanban}>
          {COLUMNS.map((col) => {
            const colJobs = byStatus[col] || [];
            return (
              <div key={col} className={styles.kanbanCol}>
                <div className={styles.kanbanHeader}>
                  <span className={styles.kanbanTitle}>{col}</span>
                  <span className={`badge badge-surface`}>{colJobs.length}</span>
                </div>
                <Droppable droppableId={col}>
                  {(provided) => (
                    <div 
                      className={styles.kanbanCards}
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                      {colJobs.map((job, index) => (
                        <Draggable key={job.id} draggableId={job.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <a href={`/app/jobs/${job.id}`} className={`${styles.jobCard} card`} id={`job-card-${job.id}`}>
                                <div className={styles.jobCardTop}>
                                  <span className={styles.jobCompany}>{job.company}</span>
                                  {job.score && (
                                    <span className={styles.jobScore}>{job.score}</span>
                                  )}
                                </div>
                                <div className={styles.jobRole}>{job.role}</div>
                                <div className={styles.jobCardBottom}>
                                  <span className={`badge badge-${STATUS_COLOR[job.status] || 'surface'}`}>{job.status}</span>
                                  <span className={styles.jobDate}>{new Date(job.discoveredAt).toLocaleDateString()}</span>
                                </div>
                              </a>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {colJobs.length === 0 && (
                        <div className={styles.kanbanEmpty}>Drop here</div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* ── Recent Activity ───────────────────────────────────────────── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent Evaluations</h2>
        <div className={`${styles.table} card`}>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr className={styles.tableHead}>
                <th>Company</th><th>Role</th><th>Score</th><th>Status</th><th>Date</th><th></th>
              </tr>
            </thead>
            <tbody>
              {activeJobs.slice(0,5).map((job) => (
                <tr key={job.id} className={styles.tableRow}>
                  <td className={styles.tableCompany}>{job.company}</td>
                  <td className={styles.tableRole}>{job.role}</td>
                  <td className={styles.tableScore}>{job.score ? `${job.score}/5` : '-'}</td>
                  <td><span className={`badge badge-${STATUS_COLOR[job.status]||'surface'}`}>{job.status}</span></td>
                  <td className={styles.tableDate}>{new Date(job.discoveredAt).toLocaleDateString()}</td>
                  <td>
                    <a href={`/app/jobs/${job.id}`} className="btn btn-ghost btn-sm" id={`view-report-${job.id}`}>View Report →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
