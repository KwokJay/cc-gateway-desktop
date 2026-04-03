import { useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { HealthCategory, HealthState } from './types';
import { notifyDanger } from './notifications';

export type DaemonStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'failed';

export interface DaemonHealth {
  status: string;
  oauth: string;
  canonical_device: string;
  canonical_platform: string;
  upstream: string;
  clients: string[];
}

const getDaemonState = (status: DaemonStatus): HealthState => {
  if (status === 'running') return 'healthy';
  if (status === 'failed') return 'danger';
  if (status === 'starting' || status === 'stopping') return 'warning';
  return 'warning'; // stopped
};

const getOauthState = (oauth: string | undefined): HealthState => {
  if (!oauth) return 'unknown';
  const lower = oauth.toLowerCase();
  if (lower.includes('error') || lower.includes('invalid') || lower.includes('expired') || lower.includes('fail')) return 'danger';
  if (lower.includes('valid') || lower.includes('ok') || lower.includes('active') || lower.includes('verified')) return 'healthy';
  return 'healthy'; // default assume healthy if exists
};

const getGeneralState = (val: string | undefined): HealthState => {
  if (!val) return 'unknown';
  const lower = val.toLowerCase();
  if (lower.includes('error') || lower.includes('fail') || lower.includes('down')) return 'danger';
  return 'healthy';
};

export const useHealthDashboard = (status: DaemonStatus, health: DaemonHealth | null) => {
  const { t } = useTranslation();
  const notifiedDanger = useRef<string | null>(null);
  const hasObservedRunning = useRef<boolean>(false);

  if (status === 'running') {
    hasObservedRunning.current = true;
  }

  const categories = useMemo<HealthCategory[]>(() => {
    const isRunning = status === 'running';

    const daemonState = getDaemonState(status);
    const daemonCategory: HealthCategory = {
      id: 'daemon',
      label: t('status.category.daemon'),
      overallState: daemonState,
      items: [
        {
          id: 'daemon_status',
          label: t('status.items.status'),
          value: t(`status.${status}`),
          state: daemonState,
        }
      ]
    };

    const authState = isRunning ? getOauthState(health?.oauth) : 'unknown';
    const authCategory: HealthCategory = {
      id: 'auth',
      label: t('status.category.auth'),
      overallState: authState,
      items: [
        {
          id: 'oauth_token',
          label: t('status.items.oauth'),
          value: isRunning ? (health?.oauth || t('common.noData')) : t('status.state.unknown'),
          state: authState,
        }
      ]
    };

    const identityState = isRunning ? (health?.canonical_device ? 'healthy' : 'warning') : 'unknown';
    const identityCategory: HealthCategory = {
      id: 'identity',
      label: t('status.category.identity'),
      overallState: identityState,
      items: [
        {
          id: 'device_id',
          label: t('status.items.device'),
          value: isRunning ? (health?.canonical_device || t('common.noData')) : t('status.state.unknown'),
          state: isRunning && health?.canonical_device ? 'healthy' : 'unknown',
        },
        {
          id: 'platform',
          label: t('status.items.platform'),
          value: isRunning ? (health?.canonical_platform || t('common.noData')) : t('status.state.unknown'),
          state: isRunning && health?.canonical_platform ? 'healthy' : 'unknown',
        }
      ]
    };

    const upstreamVal = health?.upstream;
    const upstreamItemState = isRunning ? getGeneralState(upstreamVal) : 'unknown';
    const upstreamCategory: HealthCategory = {
      id: 'upstream',
      label: t('status.category.upstream'),
      overallState: upstreamItemState,
      items: [
        {
          id: 'upstream_endpoint',
          label: t('status.items.upstream'),
          value: isRunning ? (upstreamVal || t('common.noData')) : t('status.state.unknown'),
          state: upstreamItemState,
        }
      ]
    };

    const clientsState = isRunning ? 'healthy' : 'unknown';
    const clientsVal = health?.clients;
    const clientsCategory: HealthCategory = {
      id: 'clients',
      label: t('status.category.clients'),
      overallState: clientsState,
      items: [
        {
          id: 'active_clients',
          label: t('status.items.clients'),
          value: isRunning ? (clientsVal && clientsVal.length > 0 ? clientsVal.join(', ') : '0') : t('status.state.unknown'),
          state: clientsState,
        }
      ]
    };

    return [daemonCategory, authCategory, identityCategory, upstreamCategory, clientsCategory];
  }, [status, health, t]);

  useEffect(() => {
    const dangerCategories = categories.filter(c => c.overallState === 'danger');
    if (dangerCategories.length > 0) {
      const dangerFingerprint = dangerCategories.map(c => c.id).sort().join(',');
      
      if (notifiedDanger.current !== dangerFingerprint) {
        // Only notify if we've observed a running cycle or explicitly failed
        if (hasObservedRunning.current || status === 'failed') {
          notifiedDanger.current = dangerFingerprint;
          const labels = dangerCategories.map(c => c.label).join(', ');
          notifyDanger(
            t('status.dashboard'),
            `Danger detected in: ${labels}`
          ).catch(console.error);
        }
      }
    } else {
      notifiedDanger.current = null;
    }
  }, [categories, status, t]);

  return categories;
};
