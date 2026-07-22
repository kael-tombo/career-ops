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
