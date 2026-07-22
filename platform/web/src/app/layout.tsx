import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Career-Ops Cloud — AI Job Search Automation',
  description: 'AI-powered job search automation. Scan 45+ company portals, get AI-scored evaluations, generate tailored CVs, and land your next role faster.',
  keywords: ['job search', 'AI automation', 'CV generator', 'job tracker', 'career automation'],
  openGraph: {
    title: 'Career-Ops Cloud',
    description: 'AI-powered job search automation. Find the roles worth your time.',
    type: 'website',
  },
};

import { SocketProvider } from '@/components/SocketProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
        </head>
        <body>
          <SocketProvider>
            {children}
          </SocketProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
