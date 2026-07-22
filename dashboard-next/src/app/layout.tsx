import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import LiveIndicator from "@/components/LiveIndicator";
import ScanAllButton from "@/components/ScanAllButton";
import JobStatusBar from "@/components/JobStatusBar";

export const metadata: Metadata = {
  title: "Career-Ops | AI Job Dashboard",
  description: "Real-time AI job search pipeline dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
              <div className="flex items-center justify-between mb-6">
                <JobStatusBar />
                <ScanAllButton />
              </div>
              {children}
            </div>
          </main>
        </div>
        <LiveIndicator />
      </body>
    </html>
  );
}
