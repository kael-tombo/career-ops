'use client';
import { useState } from 'react';
import { useApi } from '@/lib/api';
import styles from '../shared.module.css';

interface Story {
  title: string;
  requirement: string;
  s: string;
  t: string;
  a: string;
  r: string;
  reflection: string;
  suggestedFor: { company: string; role: string }[];
}

export default function InterviewPrepPage() {
  const { data: stories, isLoading } = useApi<Story[]>('/api/profile/stories');
  const [expandedStory, setExpandedStory] = useState<string | null>(null);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dynamic Story Bank</h1>
          <p className={styles.subtitle}>Behavioral STAR+R stories extracted from your AI job evaluations.</p>
        </div>
        <div className={styles.headerActions}>
          <a href="/app/interview/practice" className="btn btn-primary btn-sm" id="btn-practice">🎙️ AI Mock Interview</a>
        </div>
      </div>
      
      <div className={styles.grid}>
        <div className={`${styles.card} card`} style={{ gridColumn: '1 / -1' }}>
          <h2>STAR+R Library</h2>
          <p className={styles.muted}>Click a story to see the full Breakdown (Situation, Task, Action, Result, Reflection).</p>
          
          {isLoading && <p>Extracting stories from evaluations...</p>}
          {!isLoading && stories?.length === 0 && <p>No stories found. Evaluate some jobs first!</p>}
          
          <div className={styles.list}>
             {stories?.map((story) => {
               const isExpanded = expandedStory === story.title;
               return (
                 <div key={story.title} className={styles.listItem} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                   <div 
                     style={{ display: 'flex', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
                     onClick={() => setExpandedStory(isExpanded ? null : story.title)}
                   >
                     <strong>{story.title}</strong>
                     <span className="badge badge-surface">{story.requirement}</span>
                   </div>
                   
                   {isExpanded && (
                     <div style={{ marginTop: '1rem', width: '100%', fontSize: '0.9rem', lineHeight: 1.5 }}>
                        <p><strong>Situation:</strong> {story.s}</p>
                        <p><strong>Task:</strong> {story.t}</p>
                        <p><strong>Action:</strong> {story.a}</p>
                        <p><strong>Result:</strong> {story.r}</p>
                        <p style={{ color: 'var(--ctp-peach)' }}><strong>Reflection:</strong> {story.reflection}</p>
                        
                        <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--ctp-subtext0)' }}>
                          <strong>Suggested for:</strong> {story.suggestedFor.map(j => `${j.company} (${j.role})`).join(', ')}
                        </div>
                     </div>
                   )}
                 </div>
               );
             })}
          </div>
        </div>
      </div>
    </div>
  );
}
