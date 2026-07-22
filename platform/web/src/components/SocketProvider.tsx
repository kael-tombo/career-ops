'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUser } from '@clerk/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface Notification {
  id: string;
  type: 'EVALUATION_COMPLETE' | 'SCAN_COMPLETE' | 'PDF_READY';
  message: string;
  jobId?: string;
  ts: number;
}

interface ScanProgress {
  current: number;
  total: number;
  company: string;
  scanRunId: string;
}

interface SocketContextType {
  socket: Socket | null;
  notifications: Notification[];
  scanProgress: ScanProgress | null;
  dismissNotification: (id: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  notifications: [],
  scanProgress: null,
  dismissNotification: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoaded } = useUser();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;

    const s = io(API_URL, {
      query: { userId: user.id },
      withCredentials: true,
    });

    s.on('connect', () => {
      console.log('📡 Connected to Career-Ops Real-time Stream');
    });

    s.on('scan_progress', (data: ScanProgress) => {
      setScanProgress(data);
    });

    s.on('notification', (data: Omit<Notification, 'id' | 'ts'>) => {
      const newNotif: Notification = {
        ...data,
        id: Math.random().toString(36).substring(2, 9),
        ts: Date.now(),
      };
      setNotifications((prev) => [newNotif, ...prev].slice(0, 5)); // Keep last 5
      
      // If scan complete, clear progress
      if (data.type === 'SCAN_COMPLETE') {
        setScanProgress(null);
      }
      
      // Auto-dismiss after 8 seconds
      setTimeout(() => {
        dismissNotification(newNotif.id);
      }, 8000);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [user, isLoaded]);

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <SocketContext.Provider value={{ socket, notifications, scanProgress, dismissNotification }}>
      {children}
      {/* Toast UI */}
      <div style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        pointerEvents: 'none'
      }}>
        {notifications.map((notif) => (
          <div key={notif.id} style={{
            background: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            borderLeft: '4px solid var(--ctp-blue)',
            minWidth: '300px',
            maxWidth: '400px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            pointerEvents: 'auto',
            animation: 'slideIn 0.3s ease-out forwards',
            cursor: 'pointer'
          }} onClick={() => dismissNotification(notif.id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--ctp-blue)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {notif.type.replace('_', ' ')}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--ctp-subtext0)' }}>Just now</span>
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{notif.message}</div>
            {notif.jobId && (
              <a href={`/app/jobs/${notif.jobId}`} style={{ fontSize: '0.8rem', color: 'var(--ctp-sky)', textDecoration: 'underline', marginTop: '0.25rem' }}>
                View Job Details
              </a>
            )}
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </SocketContext.Provider>
  );
};
