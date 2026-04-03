import { HealthState } from './types';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';

export function StateMarker({ state }: { state: HealthState }) {
  const { t } = useTranslation();
  
  const getMarker = () => {
    switch (state) {
      case 'healthy':
        return (
          <div className="flex items-center space-x-1.5 text-slate-900 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="text-xs uppercase tracking-wider">{t('status.state.healthy')}</span>
          </div>
        );
      case 'warning':
        return (
          <div className="flex items-center space-x-1.5 text-slate-500 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-xs uppercase tracking-wider">{t('status.state.warning')}</span>
          </div>
        );
      case 'danger':
        return (
          <div className="flex items-center space-x-1.5 text-slate-900 font-bold border-b border-slate-900 pb-0.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="text-xs uppercase tracking-wider">{t('status.state.danger')}</span>
          </div>
        );
      case 'unknown':
      default:
        return (
          <div className="flex items-center space-x-1.5 text-slate-400 font-medium">
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="text-xs uppercase tracking-wider">{t('status.state.unknown')}</span>
          </div>
        );
    }
  };

  return getMarker();
}
