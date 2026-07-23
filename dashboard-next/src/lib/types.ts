export interface Application {
  id: string;
  date: string;
  company: string;
  role: string;
  score: string;
  status: string;
  pdf: string;
  report: string;
  notes: string;
  url?: string;
}

export interface PipelineItem {
  id: string;
  company: string;
  role: string;
  pdf?: string;
  score?: string;
  action?: string;
  url?: string;
  tag?: string | null;
}

export interface Profile {
  candidate: {
    full_name: string;
    email: string;
    location: string;
    timezone: string;
  };
  target_roles: {
    primary: string[];
    archetypes: { name: string; level: string; fit: string }[];
  };
  location: {
    target_regions?: {
      primary?: string[];
      secondary?: string[];
    };
  };
  compensation: {
    target_range: string;
    currency: string;
  };
}

export interface ReportMeta {
  name: string;
}

export interface PrepMeta {
  name: string;
  stats?: { mtime?: string; size?: number };
}

export interface Diagnostics {
  env: string;
  cv: boolean;
  profile: boolean;
  portals: boolean;
}

export interface DashboardData {
  applications: Application[];
  pipeline: { items: PipelineItem[] };
  reports: ReportMeta[];
  profile: Profile | null;
  preps: PrepMeta[];
  storyBank: string;
  diagnostics: Diagnostics | null;
}

export interface JobStatus {
  id: string;
  type: 'scan' | 'evaluate' | 'tailor' | 'prep-form' | 'liveness-check' | 'global-sweep' | 'mass-scan' | 'mass-apply';
  state: 'queued' | 'running' | 'completed' | 'failed';
  payload: Record<string, unknown>;
  result?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface GlobalCapabilities {
  searchEngines: number;
  searchEngineTLDs: number;
  countries: number;
  jobBoards: number;
  proxyFingerprints: number;
  maxRPM: number;
  sitemapCrawlLimit: number;
}

export interface CountryData {
  name: string;
  tld: string;
  lang: string;
  engines: string[];
  boardCount: number;
  boards: string[];
}

export interface SweepStatus {
  id: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  jobsFound?: number;
  countriesCovered?: number;
  error?: string;
}

export interface ScanHistoryEntry {
  url: string;
  company?: string;
  date?: string;
  source?: string;
}

// ── Memory System ──────────────────────────────────────────

export interface MemoryLearning {
  id: number;
  category: string;
  key: string;
  value: any;
  confidence: number;
  source: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface MemoryFeedback {
  id: number;
  company: string;
  role: string;
  url: string;
  original_score: number;
  user_score: number;
  user_rating: number;
  user_notes: string;
  action_taken: string;
  created_at: string;
}

export interface MemoryCompany {
  company: string;
  industry: string;
  size_category: string;
  total_jobs_seen: number;
  total_applied: number;
  total_responded: number;
  total_interviewed: number;
  total_offers: number;
  total_rejected: number;
  total_skipped: number;
  avg_score: number;
  avg_response_days: number | null;
  last_interaction: string;
  preferred_keywords: string[];
  avoided_keywords: string[];
  common_roles: string[];
}

export interface MemoryPreference {
  category: string;
  key: string;
  signal: number;
  count: number;
  last_seen: string;
}

export interface MemoryPattern {
  pattern_type: string;
  pattern: string;
  weight: number;
  sample_size: number;
  metadata: any;
}

export interface MemorySnapshot {
  learnings: { total: number; byCategory: { category: string; count: number; avg_confidence: number }[] };
  feedback: { total: number; avgUserScore: number; avgRating: number; byAction: { action_taken: string; count: number }[] };
  companies: { total: number; totalApplied: number; totalResponded: number; totalInterviewed: number; totalOffers: number; totalRejected: number; avgResponseRate: number };
  preferences: { categories: { category: string; count: number; total_signal: number }[]; topLikes: MemoryPreference[]; topDislikes: MemoryPreference[] };
  patterns: { total: number; byType: { pattern_type: string; count: number; avg_weight: number }[] };
  lastUpdated: string;
}
