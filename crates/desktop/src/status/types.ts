export type HealthState = 'healthy' | 'warning' | 'danger' | 'unknown';

export interface HealthItem {
  id: string;
  label: string;
  value: string;
  state: HealthState;
  reason?: string;
  recommendation?: string;
}

export interface HealthCategory {
  id: string;
  label: string;
  description?: string;
  items: HealthItem[];
  overallState: HealthState;
}
