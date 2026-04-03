export type HealthState = 'healthy' | 'warning' | 'danger' | 'unknown';

export interface HealthItem {
  id: string;
  label: string;
  value: string;
  state: HealthState;
}

export interface HealthCategory {
  id: string;
  label: string;
  items: HealthItem[];
  overallState: HealthState;
}
