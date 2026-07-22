'use client';

import { useEffect, useState } from 'react';

export default function LiveIndicator() {
  const [online, setOnline] = useState(true);
  const [time, setTime] = useState('');

  useEffect(() => {
    let es: EventSource | null = null;
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const trySSE = () => {
      try {
        es = new EventSource('http://localhost:3001/api/events');
        es.onopen = () => {
          if (!cancelled) {
            setOnline(true);
            setTime(new Date().toLocaleTimeString());
          }
        };
        es.onerror = () => {
          if (!cancelled) {
            es?.close();
            es = null;
            startPolling();
          }
        };
      } catch {
        if (!cancelled) startPolling();
      }
    };

    const startPolling = () => {
      if (cancelled) return;
      const check = async () => {
        try {
          const res = await fetch('http://localhost:3001/api/diagnostics');
          if (!cancelled) {
            setOnline(res.ok);
            setTime(new Date().toLocaleTimeString());
          }
        } catch {
          if (!cancelled) setOnline(false);
        }
      };
      check();
      pollingInterval = setInterval(check, 15000);
    };

    trySSE();

    return () => {
      cancelled = true;
      if (es) es.close();
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, []);

  return (
    <div className="fixed bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-[var(--color-text-muted)] z-50">
      <div className={`live-dot ${online ? '' : 'live-dot-offline'}`} />
      <span>{online ? 'Live' : 'Offline'}</span>
      {time && <span className="opacity-50">{time}</span>}
    </div>
  );
}
