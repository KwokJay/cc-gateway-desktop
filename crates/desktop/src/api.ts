import { invoke } from '@tauri-apps/api/core';

export interface ConfigSummary {
  port: number;
  upstream: string;
  deviceId: string;
  clients: string[];
  identity: IdentitySummary;
  oauth: OAuthSummary;
  env: EnvSummary;
  promptEnv: PromptEnvSummary;
  process: ProcessSummary;
  logging: LoggingSummary;
  canonicalProfilePath: string | null;
  logPath: string;
  proxy: ProxySummary;
  launcher: LauncherSummary;
}

export interface IdentitySummary {
  deviceId: string;
  email: string;
  accountUuid: string;
  sessionId: string;
}

export interface OAuthSummary {
  accessTokenPresent: boolean;
  refreshTokenPresent: boolean;
  expiresAt: number | null;
  expired: boolean | null;
}

export interface CiFlagsSummary {
  isCi: boolean;
  isClaubbit: boolean;
  isClaudeCodeRemote: boolean;
  isLocalAgentMode: boolean;
  isConductor: boolean;
  isGithubAction: boolean;
  isClaudeCodeAction: boolean;
}

export interface EnvSummary {
  source: string;
  keyCount: number;
  platform: string;
  platformRaw: string;
  arch: string;
  nodeVersion: string;
  terminal: string;
  packageManagers: string;
  runtimes: string;
  isRunningWithBun: boolean;
  isClaudeAiAuth: boolean;
  deploymentEnvironment: string;
  version: string;
  versionBase: string;
  buildTime: string;
  vcs: string;
  ciFlags: CiFlagsSummary;
}

export interface PromptEnvSummary {
  platform: string;
  shell: string;
  osVersion: string;
  workingDir: string;
}

export interface ProcessSummary {
  constrainedMemory: number;
  rssRange: [number, number];
  heapTotalRange: [number, number];
  heapUsedRange: [number, number];
}

export interface LoggingSummary {
  level: string;
  audit: boolean;
}

export interface ProxySummary {
  httpProxy: string | null;
  httpsProxy: string | null;
}

export interface LauncherSummary {
  available: boolean;
  path: string | null;
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
