import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { 
  Settings, 
  FileText, 
  SlidersHorizontal,
  Server,
  LayoutGrid
} from 'lucide-react';
import './i18n';

// Import our new StatusDashboard logic
import { StatusTab } from './status/StatusTab';

export type DaemonStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'failed';

export interface DaemonHealth {
  status: string;
  oauth: string;
  canonical_device: string;
  canonical_platform: string;
  upstream: string;
  clients: string[];
}

function ConfigTab() {
  const { t } = useTranslation();
  
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-xl font-medium text-slate-900 tracking-tight">{t('config.title')}</h2>
      </div>
      
      <div className="border border-slate-900 bg-slate-50 text-slate-900 px-4 py-3 text-sm flex items-center">
        <span className="w-2 h-2 rounded-full bg-slate-900 mr-3"></span>
        {t('config.readonly')}
      </div>

      <div className="bg-white border border-slate-200 flex-1 flex flex-col overflow-hidden min-h-[300px]">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('config.path')}</span>
          <span className="text-xs text-slate-600 font-mono bg-white px-2 py-1 border border-slate-200">~/.ccgw/config.yaml</span>
        </div>
        <div className="p-5 flex-1 overflow-auto bg-slate-50/50">
          <pre className="text-sm font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
{`# Example configuration structure
server:
  port: 8443
upstream:
  url: "https://api.anthropic.com"
oauth:
  refresh_token: "***"
auth:
  tokens:
    - name: "alice"
      token: "ccg-***"
identity:
  device_id: "canonical-device-id"
`}
          </pre>
        </div>
      </div>
    </div>
  );
}

function LogsTab() {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-xl font-medium text-slate-900 tracking-tight">{t('logs.title')}</h2>
      </div>
      <div className="bg-white border border-slate-200 flex-1 p-8 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 border-2 border-slate-900 flex items-center justify-center mb-6">
          <FileText className="w-8 h-8 text-slate-900" />
        </div>
        <p className="text-sm font-medium text-slate-600 max-w-sm tracking-wide">{t('logs.placeholder')}</p>
      </div>
    </div>
  );
}

function SettingsTab() {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh-CN' ? 'en' : 'zh-CN';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-xl font-medium text-slate-900 tracking-tight">{t('settings.title')}</h2>
      </div>
      
      <div className="bg-white border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 tracking-wide">{t('settings.language')}</h3>
              <p className="text-sm text-slate-500 mt-1">{i18n.language === 'zh-CN' ? '切换语言到英文' : 'Switch language to Chinese'}</p>
            </div>
            <button
              onClick={toggleLanguage}
              className="px-5 py-2 bg-slate-900 border border-slate-900 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              {i18n.language === 'zh-CN' ? 'English' : '中文'}
            </button>
          </div>
        </div>

        <div className="p-6">
          <h3 className="font-bold text-slate-900 tracking-wide mb-2">{t('settings.startupBehavior')}</h3>
          <p className="text-sm text-slate-500 mb-6">{t('settings.startupBehaviorDesc')}</p>
          
          <div className="space-y-5">
            <label className="flex items-center space-x-4 text-sm text-slate-500 group cursor-not-allowed">
              <div className="relative flex items-center">
                <input type="checkbox" className="peer w-5 h-5 border-2 border-slate-300 bg-slate-100 text-slate-400 disabled:cursor-not-allowed" disabled checked />
              </div>
              <span className="font-medium">{t('settings.autostart')}</span>
            </label>
            <label className="flex items-center space-x-4 text-sm text-slate-500 group cursor-not-allowed">
              <div className="relative flex items-center">
                <input type="checkbox" className="peer w-5 h-5 border-2 border-slate-300 bg-slate-100 text-slate-400 disabled:cursor-not-allowed" disabled checked />
              </div>
              <span className="font-medium">{t('settings.startMinimized')}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

type TabId = 'status' | 'config' | 'logs' | 'settings';

export default function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('status');

  // Shared health state hoisted to root
  const [status, setStatus] = useState<DaemonStatus>('stopped');
  const [health, setHealth] = useState<DaemonHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const currentStatus = await invoke<DaemonStatus>('get_daemon_status');
      setStatus(currentStatus);
      
      if (currentStatus === 'running') {
        try {
          const currentHealth = await invoke<DaemonHealth>('get_daemon_health');
          setHealth(currentHealth);
        } catch (healthErr) {
          console.error("Health check failed", healthErr);
          setHealth(null);
        }
      } else {
        setHealth(null);
      }
      setError(null);
    } catch (err) {
      console.error("Failed to fetch status", err);
      setError(String(err));
    }
  }, []);

  // Polling loop runs regardless of active tab
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleToggle = async () => {
    setLoading(true);
    setError(null);
    try {
      if (status === 'running' || status === 'starting') {
        await invoke('stop_daemon');
      } else {
        await invoke('start_daemon');
      }
      await fetchStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

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
          {activeTab === 'config' && <ConfigTab />}
          {activeTab === 'logs' && <LogsTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}
