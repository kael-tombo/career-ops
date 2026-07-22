'use client';

import { useEffect, useState, useCallback } from 'react';
import { subscribeToEvents } from '@/lib/api';
import type { JobStatus } from '@/lib/types';
import { Loader2, CheckCircle2, XCircle, ScanLine } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function JobStatusBar() {
  const [activeJobs, setActiveJobs] = useState<Map<string, JobStatus>>(new Map());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    const unsub = subscribeToEvents({
      onJobUpdate: (job) => {
        setActiveJobs(prev => {
          const next = new Map(prev);
          next.set(job.id, job);
          if (job.state === 'completed' || job.state === 'failed') {
            setTimeout(() => {
              setActiveJobs(curr => {
                const updated = new Map(curr);
                updated.delete(job.id);
                return updated;
              });
            }, 3000);
          }
          return next;
        });
        if (job.state === 'completed') {
          addToast(`Job complete: ${job.type}`, 'success');
        } else if (job.state === 'failed') {
          addToast(`Job failed: ${job.type}`, 'error');
        }
      },
      onScanResults: (data) => {
        addToast(`Scan complete: ${data.count} new jobs from ${data.company || data.platform}`, 'success');
      },
    });
    return unsub;
  }, [addToast]);

  const activeCount = Array.from(activeJobs.values()).filter(
    j => j.state === 'queued' || j.state === 'running'
  ).length;

  const runningTypes = Array.from(activeJobs.values())
    .filter(j => j.state === 'queued' || j.state === 'running')
    .map(j => j.type);

  return (
    <>
      {activeCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-primary)]/10 text-xs text-[var(--color-primary-light)]">
          <Loader2 size={12} className="animate-spin" />
          <span>
            {activeCount} active job{activeCount > 1 ? 's' : ''}: {runningTypes.join(', ')}
          </span>
        </div>
      )}

      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg glass text-sm shadow-lg animate-in slide-in-from-top-2 ${
              toast.type === 'success' ? 'text-[var(--color-green)]' :
              toast.type === 'error' ? 'text-[var(--color-red)]' :
              'text-[var(--color-primary-light)]'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={14} /> :
             toast.type === 'error' ? <XCircle size={14} /> :
             <ScanLine size={14} />}
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
