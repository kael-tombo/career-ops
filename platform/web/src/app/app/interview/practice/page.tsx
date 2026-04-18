'use client';
import { useState, useRef, useEffect } from 'react';
import { useApi, fetchApi } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';
import styles from '../../shared.module.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Job {
  id: string;
  company: string;
  role: string;
}

export default function InterviewPracticePage() {
  const { data: jobs, isLoading: jobsLoading } = useApi<Job[]>('/api/jobs');
  const { getToken } = useAuth();
  
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleStart = async () => {
    if (!selectedJobId) return;
    setMessages([]);
    setIsTyping(true);
    try {
      const res = await fetchApi(`/api/interview/practice`, {
        method: 'POST',
        body: JSON.stringify({ jobId: selectedJobId, messageHistory: [] }),
      }, getToken);
      setMessages([{ role: 'assistant', content: res.reply }]);
    } catch (err: any) {
      alert(err.message || 'Failed to start interview');
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedJobId) return;
    
    const newMessages: Message[] = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetchApi(`/api/interview/practice`, {
        method: 'POST',
        body: JSON.stringify({ jobId: selectedJobId, messageHistory: newMessages }),
      }, getToken);
      setMessages([...newMessages, { role: 'assistant', content: res.reply }]);
    } catch (err: any) {
      alert(err.message || 'Failed to get response');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <a href="/app/interview" className={styles.back} style={{ display: 'inline-block', marginBottom: '0.5rem' }}>← Back to Story Bank</a>
          <h1 className={styles.title}>AI Interview Simulator</h1>
          <p className={styles.subtitle}>Practice your behavioral answers with an AI Hiring Manager.</p>
        </div>
      </div>

      <div className={`${styles.card} card`} style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
        {!messages.length ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '1rem' }}>Select a role to practice for:</h2>
            {jobsLoading ? (
              <p>Loading jobs...</p>
            ) : (
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center' }}>
                <select 
                  className="input" 
                  value={selectedJobId} 
                  onChange={e => setSelectedJobId(e.target.value)}
                  style={{ minWidth: '300px' }}
                >
                  <option value="" disabled>Select an evaluated job...</option>
                  {jobs?.map(j => (
                    <option key={j.id} value={j.id}>{j.company} - {j.role}</option>
                  ))}
                </select>
                <button 
                  className="btn btn-primary" 
                  onClick={handleStart} 
                  disabled={!selectedJobId || isTyping}
                >
                  Start Interview
                </button>
              </div>
            )}
            <p className={styles.muted} style={{ marginTop: '2rem' }}>
              The AI will read the job requirements and your evaluated gaps to tailor the questions.
            </p>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {messages.map((m, i) => (
                <div key={i} style={{ 
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: m.role === 'user' ? 'var(--ctp-blue)' : 'var(--ctp-surface1)',
                  color: m.role === 'user' ? 'var(--ctp-base)' : 'var(--ctp-text)',
                  padding: '1rem',
                  borderRadius: '12px',
                  maxWidth: '80%',
                  lineHeight: 1.5
                }}>
                  <strong>{m.role === 'user' ? 'You' : 'Hiring Manager'}</strong>
                  <div style={{ marginTop: '0.5rem' }}>{m.content}</div>
                </div>
              ))}
              {isTyping && (
                <div style={{ alignSelf: 'flex-start', backgroundColor: 'var(--ctp-surface1)', padding: '1rem', borderRadius: '12px' }}>
                  <em>Hiring Manager is typing...</em>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            
            <div style={{ padding: '1rem', borderTop: '1px solid var(--ctp-surface2)', display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                className="input" 
                style={{ flex: 1 }} 
                placeholder="Type your answer using the STAR method..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button className="btn btn-primary" onClick={handleSend} disabled={!input.trim() || isTyping}>
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
