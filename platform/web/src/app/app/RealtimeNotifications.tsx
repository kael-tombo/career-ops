'use client';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useUser } from '@clerk/nextjs';

export default function RealtimeNotifications() {
  const { user } = useUser();
  const [notification, setNotification] = useState<{ message: string; type: string } | null>(null);

  useEffect(() => {
    if (!user) return;

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002', {
      query: { userId: user.id }
    });

    socket.on('notification', (data) => {
      setNotification(data);
      // Auto-hide after 5 seconds
      setTimeout(() => setNotification(null), 5000);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  if (!notification) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      backgroundColor: 'var(--ctp-surface0)',
      border: '1px solid var(--ctp-blue)',
      borderRadius: '12px',
      padding: '16px 20px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      animation: 'slideUp 0.3s ease-out'
    }}>
      <div style={{ fontSize: '20px' }}>
        {notification.type === 'EVALUATION_COMPLETE' ? '✅' : '🔍'}
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: '14px' }}>{notification.type.replace('_', ' ')}</div>
        <div style={{ fontSize: '13px', color: 'var(--ctp-subtext1)' }}>{notification.message}</div>
      </div>
      <button 
        style={{ background: 'none', border: 'none', color: 'var(--ctp-overlay2)', cursor: 'pointer', padding: '4px' }}
        onClick={() => setNotification(null)}
      >
        ✕
      </button>

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
