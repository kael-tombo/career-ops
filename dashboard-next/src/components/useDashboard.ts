'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchDashboardData, subscribeToEvents } from '@/lib/api';
import type { DashboardData } from '@/lib/types';

export function useDashboard(refreshInterval = 30000) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const refresh = useCallback(async () => {
    try {
      const d = await fetchDashboardData();
      setData(d);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Dashboard refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, refreshInterval);

    const unsub = subscribeToEvents({
      onScanResults: () => {
        refresh();
      },
      onJobUpdate: (job) => {
        if (job.state === 'completed') {
          refresh();
        }
      },
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [refresh, refreshInterval]);

  return { data, loading, lastUpdate, refresh };
}
