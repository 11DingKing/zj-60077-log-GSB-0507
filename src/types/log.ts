import { LogLevel } from '@prisma/client';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  metadata: Record<string, unknown>;
}

export interface QueuedLog extends LogEntry {
  serviceId: string;
  receivedAt: string;
}

export interface LogQueryParams {
  startTime?: string;
  endTime?: string;
  levels?: LogLevel[];
  serviceNames?: string[];
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LogAggregationParams {
  startTime: string;
  endTime: string;
  granularity: '1min' | '5min' | '1h' | '1d';
  serviceNames?: string[];
}

export interface AggregationResult {
  timestamp: string;
  serviceName?: string;
  level: LogLevel;
  count: number;
}

export interface ServiceLogStats {
  serviceName: string;
  totalLogs: number;
  errorCount: number;
  warningCount: number;
}
