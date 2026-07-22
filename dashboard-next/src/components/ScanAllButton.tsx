'use client';

import { useState } from 'react';
import { submitScan } from '@/lib/api';
import { ScanLine, Loader2, CheckCircle2 } from 'lucide-react';

export default function ScanAllButton() {
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    setDone(false);
    await submitScan();
    setScanning(false);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };

  return (
    <button
      onClick={handleScan}
      disabled={scanning}
      title="Search all portals for new jobs"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)]/10 text-sm text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/20 disabled:opacity-50 transition-all shrink-0"
    >
      {scanning ? (
        <><Loader2 size={16} className="animate-spin" /> Scanning...</>
      ) : done ? (
        <><CheckCircle2 size={16} className="text-[var(--color-green)]" /> Done</>
      ) : (
        <><ScanLine size={16} /> Scan All</>
      )}
    </button>
  );
}
