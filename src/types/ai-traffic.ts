// src/types/ai-traffic.ts
import type { ChartPoint, KpiDatum } from './dashboard';

export interface AiTrafficData {
  totalSessions: number;
  totalUsers: number;
  sessionsBySource: {
    [source: string]: number;
  };
  topAiSources: Array<{
    source: string;
    sessions: number;
    users: number;
    percentage: number;
  }>;
  trend: Array<{
    date: string;
    sessions: number; // Dies kommt von der google-api
  }>;

  // Diese werden im Loader hinzugefügt
  totalSessionsChange?: number; 
  totalUsersChange?: number;
}

// Props für die AiTrafficCard React-Komponente
export interface AiTrafficCardProps {
  totalSessions?: number;
  totalUsers?: number;
  percentage?: number;
  
  totalSessionsChange?: number;
  totalUsersChange?: number;
  
  // WICHTIG: trend erwartet hier ChartPoint ({ date, value }),
  // da die ProjectDashboard-Komponente die Daten transformiert.
  trend?: ChartPoint[]; 

  topAiSources?: Array<{
    source: string;
    sessions: number;
    users: number;
    percentage: number;
  }>;
  isLoading?: boolean;
  dateRange?: string;
  className?: string;
  error?: string | null;
}
