export type HttpMethod = 'GET' | 'POST';

export type FieldDataType = 'Text' | 'Number' | 'Link' | 'Image';

export type CleaningRule = 'None' | 'Trim' | 'Remove currency' | 'Extract numbers';

export type PaginationMode = 'None' | 'Auto-detect' | 'Manual';

export type UserAgentPreset = 'Chrome' | 'Firefox' | 'Safari' | 'Custom';

export interface HeaderPair {
  id: string;
  key: string;
  value: string;
}

export interface ScraperField {
  id: string;
  name: string;
  selector: string;
  dataType: FieldDataType;
  cleaningRule: CleaningRule;
}

export interface PaginationConfig {
  mode: PaginationMode;
  nextButtonSelector?: string;
  maxPages?: number;
}

export interface RunSettings {
  delayBetweenRequests: number; // seconds
  retryOnFailure: number;
  respectRobotsTxt: boolean;
  userAgent: UserAgentPreset;
  customUserAgent?: string;
}

export interface ScraperConfig {
  url: string;
  method: HttpMethod;
  headers: HeaderPair[];
  fields: ScraperField[];
  rowContainerSelector?: string;
  pagination: PaginationConfig;
  runSettings: RunSettings;
}

export type ScheduleFrequency = 'none' | 'hourly' | 'daily' | 'weekly';

export interface ProjectSchedule {
  frequency: ScheduleFrequency;
  time?: string;
  day?: number;
  outputFolder?: string;
  enabled: boolean;
}

export interface CompareChangedRow {
  old: Record<string, string | number | null>;
  new: Record<string, string | number | null>;
  changedFields: string[];
}

export interface CompareRunsResult {
  added: Record<string, string | number | null>[];
  removed: Record<string, string | number | null>[];
  changed: CompareChangedRow[];
  unchanged: Record<string, string | number | null>[];
  headers: string[];
}

export type CompareRowStatus = 'new' | 'removed' | 'changed' | 'unchanged';

export interface CompareTableRow {
  status: CompareRowStatus;
  row?: Record<string, string | number | null>;
  old?: Record<string, string | number | null>;
  new?: Record<string, string | number | null>;
  changedFields?: string[];
}

export interface RunHistoryEntry {
  id: number;
  projectId: string;
  timestamp: string;
  rowsCollected: number;
  outputPath?: string;
  status: string;
}

export interface ScraperProject {
  id: string;
  name: string;
  url: string;
  config: ScraperConfig;
  lastRunAt?: string;
  lastRowCount?: number;
  fieldCount: number;
  schedule?: ProjectSchedule;
}

export interface ScrapeRow {
  [fieldName: string]: string | number | null;
}

export interface ScrapeProgress {
  page: number;
  total_pages: number;
  rows: number;
  speed: number; // rows per minute
  errors: number;
  eta_seconds: number;
}

export type ExportFormat = 'CSV' | 'XLSX' | 'JSON';

export interface ExportRecord {
  id: number;
  filename: string;
  format: string;
  rows: number;
  filePath: string;
  exportedAt: string;
  fileSize?: number;
}
