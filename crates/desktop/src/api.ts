import { invoke } from '@tauri-apps/api/core';

export interface ConfigSummary {
  port: number;
  upstream: string;
  deviceId: string;
  clients: string[];
}

export interface ConfigSnapshot {
  path: string;
  exists: boolean;
  content: string;
  summary: ConfigSummary | null;
  validationError: string | null;
}

export interface LogSnapshot {
  path: string;
  exists: boolean;
  lines: string[];
}

export interface DesktopSettings {
  startMinimized: boolean;
}

export async function getConfigSnapshot(configPath?: string): Promise<ConfigSnapshot> {
  return invoke('get_config_snapshot', { config_path: configPath ?? null });
}

export async function saveConfigSnapshot(content: string, configPath?: string): Promise<ConfigSnapshot> {
  return invoke('save_config_snapshot', { content, config_path: configPath ?? null });
}

export async function getDaemonLogs(limit = 200): Promise<LogSnapshot> {
  return invoke('get_daemon_logs', { limit });
}

export async function getDesktopSettings(): Promise<DesktopSettings> {
  return invoke('get_desktop_settings');
}

export async function setStartMinimized(startMinimized: boolean): Promise<DesktopSettings> {
  return invoke('set_start_minimized', { start_minimized: startMinimized });
}

export async function isAutostartEnabled(): Promise<boolean> {
  return invoke('plugin:autostart|is_enabled');
}

export async function setAutostartEnabled(enabled: boolean): Promise<void> {
  await invoke(enabled ? 'plugin:autostart|enable' : 'plugin:autostart|disable');
}
