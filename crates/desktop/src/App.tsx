import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import {
  Settings,
  FileText,
  SlidersHorizontal,
  Server,
  LayoutGrid,
  RefreshCw,
  Save,
  FolderOpen,
  Search,
} from 'lucide-react';
import './i18n';
import { StatusTab } from './status/StatusTab';
import type { ConfigSnapshot, DesktopSettings, LogSnapshot } from './api';
import {
  getConfigSnapshot,
  getDaemonLogs,
  getDesktopSettings,
  isAutostartEnabled,
  saveConfigSnapshot,
  setAutostartEnabled,
  setStartMinimized,
} from './api';

export type DaemonStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'failed';

export interface DaemonHealth {
  status: string;
  oauth: string;
  canonical_device: string;
  canonical_platform: string;
  upstream: string;
  clients: string[];
}

function fileTarget(path: string, exists: boolean) {
  if (exists) {
    return path;
  }

  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index > 0 ? path.slice(0, index) : path;
}

function ToggleRow({
  checked,
  disabled,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`flex items-start justify-between gap-6 border border-slate-200 p-4 ${disabled ? 'opacity-60' : ''}`}>
      <div>
        <div className="font-semibold text-slate-900">{label}</div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full border transition-colors ${
          checked ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-white'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}

function ConfigTab({
  config,
  draft,
  busy,
  message,
  error,
  onDraftChange,
  onReload,
  onSave,
  onOpen,
}: {
  config: ConfigSnapshot | null;
  draft: string;
  busy: boolean;
  message: string | null;
  error: string | null;
  onDraftChange: (value: string) => void;
  onReload: () => void;
  onSave: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="pb-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-slate-900 tracking-tight">{t('config.title')}</h2>
          <p className="mt-2 text-sm text-slate-500">{config?.path ?? '~/.ccgw/config.yaml'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="px-4 py-2 border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            <span>{t('config.open')}</span>
          </button>
          <button
            type="button"
            onClick={onReload}
            className="px-4 py-2 border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{t('config.reload')}</span>
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="px-4 py-2 border border-slate-900 bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{t('common.save')}</span>
          </button>
        </div>
      </div>

      {!config?.exists && (
        <div className="border border-slate-900 bg-slate-50 text-slate-900 px-4 py-3 text-sm flex items-center">
          <span className="w-2 h-2 rounded-full bg-slate-900 mr-3"></span>
          {t('config.example')}
        </div>
      )}

      {config?.summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard label={t('config.port')} value={String(config.summary.port)} />
          <SummaryCard label={t('config.upstream')} value={config.summary.upstream} />
          <SummaryCard label={t('config.deviceId')} value={config.summary.deviceId} />
          <SummaryCard label={t('config.clients')} value={config.summary.clients.join(', ') || t('common.noData')} />
        </div>
      )}

      {config?.validationError && (
        <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">{t('config.validationError')}:</span> {config.validationError}
        </div>
      )}

      {message && (
        <div className="border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div>
      )}

      {error && (
        <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      )}

      <div className="bg-white border border-slate-200 flex-1 flex flex-col overflow-hidden min-h-[360px]">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('config.path')}</span>
          <span className="text-xs text-slate-600 font-mono bg-white px-2 py-1 border border-slate-200">{config?.path ?? '~/.ccgw/config.yaml'}</span>
        </div>
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          spellCheck={false}
          className="flex-1 resize-none border-0 bg-slate-50/50 p-5 font-mono text-sm leading-relaxed text-slate-800 focus:outline-none"
        />
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 break-all font-mono text-sm text-slate-800">{value}</div>
    </div>
  );
}

function LogsTab({
  logs,
  filter,
  loading,
  error,
  onFilterChange,
  onRefresh,
  onOpen,
}: {
  logs: LogSnapshot | null;
  filter: string;
  loading: boolean;
  error: string | null;
  onFilterChange: (value: string) => void;
  onRefresh: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  const filteredLines = useMemo(() => {
    if (!logs) {
      return [];
    }

    if (!filter.trim()) {
      return logs.lines;
    }

    const query = filter.toLowerCase();
    return logs.lines.filter((line) => line.toLowerCase().includes(query));
  }, [filter, logs]);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="pb-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-slate-900 tracking-tight">{t('logs.title')}</h2>
          <p className="mt-2 text-sm text-slate-500">{logs?.path ?? '~/.ccgw/logs/desktop-daemon.log'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="px-4 py-2 border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            <span>{t('logs.open')}</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-4 py-2 border border-slate-900 bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{t('common.refresh')}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-slate-500">
          <Search className="w-4 h-4" />
          <span className="text-sm font-medium">{t('logs.search')}</span>
        </div>
        <input
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder={t('logs.search')}
          className="flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none"
        />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{filteredLines.length} {t('logs.lines')}</span>
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      )}

      <div className="bg-white border border-slate-200 flex-1 flex flex-col overflow-hidden min-h-[360px]">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 text-xs font-bold uppercase tracking-widest text-slate-500">
          {t('logs.path')}: {logs?.path ?? '~/.ccgw/logs/desktop-daemon.log'}
        </div>
        <div className="flex-1 overflow-auto bg-slate-950 px-5 py-4 text-sm font-mono text-slate-100">
          {!logs?.exists && <div className="text-slate-400">{t('logs.empty')}</div>}
          {logs?.exists && filteredLines.length === 0 && <div className="text-slate-400">{t('logs.noMatches')}</div>}
          {filteredLines.map((line, index) => (
            <div key={`${index}-${line.slice(0, 24)}`} className="whitespace-pre-wrap break-all leading-relaxed">
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsTab({
  settings,
  autostartEnabled,
  loading,
  error,
  onToggleLanguage,
  onToggleAutostart,
  onToggleStartMinimized,
}: {
  settings: DesktopSettings | null;
  autostartEnabled: boolean;
  loading: boolean;
  error: string | null;
  onToggleLanguage: () => void;
  onToggleAutostart: (enabled: boolean) => void;
  onToggleStartMinimized: (enabled: boolean) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-xl font-medium text-slate-900 tracking-tight">{t('settings.title')}</h2>
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      )}

      <div className="bg-white border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex justify-between items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-900 tracking-wide">{t('settings.language')}</h3>
              <p className="text-sm text-slate-500 mt-1">{i18n.language === 'zh-CN' ? '切换语言到英文' : 'Switch language to Chinese'}</p>
            </div>
            <button
              type="button"
              onClick={onToggleLanguage}
              className="px-5 py-2 bg-slate-900 border border-slate-900 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              {i18n.language === 'zh-CN' ? 'English' : '中文'}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <h3 className="font-bold text-slate-900 tracking-wide mb-2">{t('settings.startupBehavior')}</h3>
          <p className="text-sm text-slate-500 mb-6">{t('settings.startupBehaviorDesc')}</p>

          <ToggleRow
            checked={autostartEnabled}
            disabled={loading}
            label={t('settings.autostart')}
            description={t('settings.autostartDesc')}
            onChange={onToggleAutostart}
          />
          <ToggleRow
            checked={settings?.startMinimized ?? false}
            disabled={loading}
            label={t('settings.startMinimized')}
            description={t('settings.startMinimizedDesc')}
            onChange={onToggleStartMinimized}
          />
        </div>
      </div>
    </div>
  );
}

type TabId = 'status' | 'config' | 'logs' | 'settings';

export default function App() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('status');
  const [status, setStatus] = useState<DaemonStatus>('stopped');
  const [health, setHealth] = useState<DaemonHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [config, setConfig] = useState<ConfigSnapshot | null>(null);
  const [configDraft, setConfigDraft] = useState('');
  const [configBusy, setConfigBusy] = useState(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const [logs, setLogs] = useState<LogSnapshot | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState('');

  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  const [autostartEnabled, setAutostartState] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const currentStatus = await invoke<DaemonStatus>('get_daemon_status');
      setStatus(currentStatus);

      if (currentStatus === 'running') {
        try {
          const currentHealth = await invoke<DaemonHealth>('get_daemon_health');
          setHealth(currentHealth);
        } catch (healthErr) {
          console.error('Health check failed', healthErr);
          setHealth(null);
        }
      } else {
        setHealth(null);
      }
      setError(null);
    } catch (statusError) {
      console.error('Failed to fetch status', statusError);
      setError(String(statusError));
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const loadConfig = useCallback(async () => {
    setConfigBusy(true);
    setConfigError(null);
    try {
      const snapshot = await getConfigSnapshot();
      setConfig(snapshot);
      setConfigDraft(snapshot.content);
      setConfigMessage(null);
    } catch (configLoadError) {
      setConfigError(String(configLoadError));
    } finally {
      setConfigBusy(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      setLogs(await getDaemonLogs(300));
    } catch (logError) {
      setLogsError(String(logError));
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const [desktopSettings, enabled] = await Promise.all([
        getDesktopSettings(),
        isAutostartEnabled(),
      ]);
      setSettings(desktopSettings);
      setAutostartState(enabled);
    } catch (settingsLoadError) {
      setSettingsError(String(settingsLoadError));
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'config' && !config && !configBusy) {
      void loadConfig();
    }
  }, [activeTab, config, configBusy, loadConfig]);

  useEffect(() => {
    if (activeTab !== 'logs') {
      return undefined;
    }

    void loadLogs();
    const interval = setInterval(() => {
      void loadLogs();
    }, 2000);
    return () => clearInterval(interval);
  }, [activeTab, loadLogs]);

  useEffect(() => {
    if (activeTab === 'settings' && !settings && !settingsLoading) {
      void loadSettings();
    }
  }, [activeTab, loadSettings, settings, settingsLoading]);

  const handleToggle = async () => {
    setLoading(true);
    setError(null);
    try {
      if (status === 'running' || status === 'starting') {
        await invoke('stop_daemon');
      } else {
        await invoke('start_daemon');
      }
      await Promise.all([fetchStatus(), loadLogs()]);
    } catch (toggleError) {
      setError(String(toggleError));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = useCallback(async () => {
    setConfigBusy(true);
    setConfigError(null);
    try {
      const snapshot = await saveConfigSnapshot(configDraft, config?.path);
      setConfig(snapshot);
      setConfigDraft(snapshot.content);
      setConfigMessage(t('config.saveSuccess'));
      await fetchStatus();
    } catch (saveError) {
      setConfigError(String(saveError));
      setConfigMessage(null);
    } finally {
      setConfigBusy(false);
    }
  }, [config?.path, configDraft, fetchStatus, t]);

  const handleOpenConfig = useCallback(async () => {
    try {
      const target = fileTarget(config?.path ?? '~/.ccgw/config.yaml', config?.exists ?? false);
      await open(target);
    } catch (openError) {
      setConfigError(String(openError));
    }
  }, [config]);

  const handleOpenLogs = useCallback(async () => {
    try {
      const target = fileTarget(logs?.path ?? '~/.ccgw/logs/desktop-daemon.log', logs?.exists ?? false);
      await open(target);
    } catch (openError) {
      setLogsError(String(openError));
    }
  }, [logs]);

  const handleToggleLanguage = useCallback(() => {
    const newLang = i18n.language === 'zh-CN' ? 'en' : 'zh-CN';
    void i18n.changeLanguage(newLang);
  }, [i18n]);

  const handleToggleAutostart = useCallback(async (enabled: boolean) => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      await setAutostartEnabled(enabled);
      setAutostartState(enabled);
    } catch (toggleError) {
      setSettingsError(String(toggleError));
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const handleToggleStartMinimized = useCallback(async (enabled: boolean) => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      setSettings(await setStartMinimized(enabled));
    } catch (toggleError) {
      setSettingsError(String(toggleError));
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const tabs = [
    { id: 'status' as TabId, icon: LayoutGrid, label: t('menu.status') },
    { id: 'config' as TabId, icon: SlidersHorizontal, label: t('menu.config') },
    { id: 'logs' as TabId, icon: FileText, label: t('menu.logs') },
    { id: 'settings' as TabId, icon: Settings, label: t('menu.settings') },
  ];

  return (
    <div className="flex h-full w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col relative z-20">
        <div className="p-6 pt-8 pb-8 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-slate-900 flex items-center justify-center">
              <Server className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold text-slate-900 tracking-tight text-lg">CC Gateway</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className="tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-50 py-2.5 px-3 border border-slate-200 text-center">
            {t('app.version')} 0.3.0
          </div>
        </div>
      </div>

      <main className="flex-1 h-full overflow-y-auto bg-slate-50/50">
        <div className="p-10 max-w-5xl mx-auto min-h-full">
          {activeTab === 'status' && (
            <StatusTab
              status={status}
              health={health}
              loading={loading}
              error={error}
              onToggle={handleToggle}
              onRefresh={fetchStatus}
            />
          )}
          {activeTab === 'config' && (
            <ConfigTab
              config={config}
              draft={configDraft}
              busy={configBusy}
              message={configMessage}
              error={configError}
              onDraftChange={setConfigDraft}
              onReload={() => void loadConfig()}
              onSave={() => void handleSaveConfig()}
              onOpen={() => void handleOpenConfig()}
            />
          )}
          {activeTab === 'logs' && (
            <LogsTab
              logs={logs}
              filter={logFilter}
              loading={logsLoading}
              error={logsError}
              onFilterChange={setLogFilter}
              onRefresh={() => void loadLogs()}
              onOpen={() => void handleOpenLogs()}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              settings={settings}
              autostartEnabled={autostartEnabled}
              loading={settingsLoading}
              error={settingsError}
              onToggleLanguage={handleToggleLanguage}
              onToggleAutostart={(enabled) => void handleToggleAutostart(enabled)}
              onToggleStartMinimized={(enabled) => void handleToggleStartMinimized(enabled)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
