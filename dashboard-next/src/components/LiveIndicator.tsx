'use client';

import { useEffect, useState } from 'react';

export default function LiveIndicator() {
  const [online, setOnline] = useState(true);
  const [time, setTime] = useState('');

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/diagnostics');
        setOnline(res.ok);
      } catch {
        setOnline(false);
      }
      setTime(new Date().toLocaleTimeString());
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-[var(--color-text-muted)] z-50">
      <div className={`live-dot ${online ? '' : 'live-dot-offline'}`} />
      <span>{online ? 'Live' : 'Offline'}</span>
      {time && <span className="opacity-50">{time}</span>}
    </div>
  );
}
