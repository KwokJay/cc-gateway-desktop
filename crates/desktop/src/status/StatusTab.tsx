import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Power, RefreshCw, Activity, Shield, Network, Server, User, LayoutGrid, TerminalSquare, Cpu, KeyRound, Rocket, EyeOff } from 'lucide-react';
import { DaemonStatus, DaemonHealth } from '../App';
import type { ConfigSnapshot, DesktopSettings } from '../api';
import { useHealthDashboard } from './useHealthDashboard';
import { StateMarker } from './StateMarker';

interface StatusTabProps {
  status: DaemonStatus;
  health: DaemonHealth | null;
  config: ConfigSnapshot | null;
  settings: DesktopSettings | null;
  autostartEnabled: boolean;
  loading: boolean;
  error: string | null;
  onToggle: () => void;
  onRefresh: () => void;
}

export function StatusTab({
  status,
  health,
  config,
  settings,
  autostartEnabled,
  loading,
  error,
  onToggle,
  onRefresh,
}: StatusTabProps) {
  const { t } = useTranslation();
  const categories = useHealthDashboard(status, health, config, settings, autostartEnabled);
  
  const [selectedId, setSelectedId] = useState<string>('identityRewrite');

  // Auto-select the first danger category if present
  useEffect(() => {
    const firstDanger = categories.find(c => c.overallState === 'danger');
    if (firstDanger) {
      setSelectedId(prev => {
        const currentIsDanger = categories.find(c => c.id === prev)?.overallState === 'danger';
        return currentIsDanger ? prev : firstDanger.id;
      });
    }
  }, [categories]);

  const selectedCategory = categories.find(c => c.id === selectedId) || categories[0];

  return (
    <div className="h-full flex flex-col space-y-6 pb-10">
      <div className="flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 flex items-center justify-center border border-slate-300 bg-white">
            <LayoutGrid className="w-4 h-4 text-slate-800" />
          </div>
          <h2 className="text-xl font-medium text-slate-900 tracking-tight">{t('status.dashboard')}</h2>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={onRefresh}
            className="p-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            title={t('common.refresh')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={onToggle}
            disabled={loading || status === 'stopping' || status === 'starting'}
            className={`px-5 py-2 flex items-center space-x-2 font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed 
              ${status === 'running' 
                ? 'bg-white text-slate-900 border-slate-900 hover:bg-slate-100' 
                : 'bg-slate-900 text-white border-transparent hover:bg-slate-800'
              }`}
          >
            <Power className="w-4 h-4" />
            <span className="text-sm tracking-wide">
              {loading ? t('common.loading') : (status === 'running' ? t('status.stop') : t('status.start'))}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-white border-2 border-slate-900 text-slate-900 text-sm flex space-x-3 items-start">
          <Activity className="w-5 h-5 flex-shrink-0" />
          <div>
            <span className="font-bold uppercase tracking-wider">{t('status.error')}:</span> 
            <span className="ml-2 font-mono">{error}</span>
          </div>
        </div>
      )}

      <div className="flex items-stretch border border-slate-200 bg-white min-h-[400px]">
        {/* Left Rail */}
        <div className="w-1/3 border-r border-slate-200 flex flex-col bg-slate-50/30">
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`p-5 flex items-center justify-between border-b border-slate-100 last:border-0 transition-colors text-left
                ${selectedId === c.id ? 'bg-white border-l-4 border-l-slate-900 shadow-sm' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}
              `}
            >
              <div className="flex items-center space-x-3">
                {getCategoryIcon(c.id, selectedId === c.id)}
                <span className={`font-medium ${selectedId === c.id ? 'text-slate-900' : 'text-slate-600'}`}>
                  {c.label}
                </span>
              </div>
              <StateMarker state={c.overallState} />
            </button>
          ))}
        </div>
        
        {/* Right Panel */}
        <div className="w-2/3 p-8 bg-white flex flex-col">
          <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              {getCategoryIcon(selectedCategory.id, true)}
              <div>
                <h3 className="text-xl font-medium text-slate-900">{selectedCategory.label}</h3>
                {selectedCategory.description && (
                  <p className="mt-2 max-w-2xl text-sm text-slate-500">{selectedCategory.description}</p>
                )}
              </div>
            </div>
            <StateMarker state={selectedCategory.overallState} />
          </div>
          
          <div className="space-y-8 flex-1">
            {selectedCategory.items.map((item) => (
              <div key={item.id}>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{item.label}</span>
                  <StateMarker state={item.state} />
                </div>
                <div className="text-sm font-mono text-slate-800 bg-slate-50 border border-slate-200 p-4 break-all">
                  {item.value}
                </div>
                {(item.reason || item.recommendation) && (
                  <div className={`mt-3 space-y-2 border p-4 text-sm ${
                    item.state === 'danger'
                      ? 'border-red-300 bg-red-50 text-red-900'
                      : item.state === 'warning'
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : 'border-slate-200 bg-white text-slate-700'
                  }`}>
                    {item.reason && (
                      <div>
                        <span className="font-semibold">{t('status.reason')}:</span> {item.reason}
                      </div>
                    )}
                    {item.recommendation && (
                      <div>
                        <span className="font-semibold">{t('status.recommendation')}:</span> {item.recommendation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getCategoryIcon(id: string, active: boolean) {
  const className = `w-5 h-5 ${active ? 'text-slate-900' : 'text-slate-400'}`;
  switch (id) {
    case 'identityRewrite': return <User className={className} />;
    case 'envRewrite': return <TerminalSquare className={className} />;
    case 'promptSanitization': return <Server className={className} />;
    case 'billingHeader': return <Shield className={className} />;
    case 'processMetrics': return <Cpu className={className} />;
    case 'zeroLoginClients': return <LayoutGrid className={className} />;
    case 'centralizedOAuth': return <KeyRound className={className} />;
    case 'instantStartup': return <Rocket className={className} />;
    case 'proxyAware': return <Network className={className} />;
    case 'telemetryLeakPrevention': return <EyeOff className={className} />;
    default: return <Activity className={className} />;
  }
}
