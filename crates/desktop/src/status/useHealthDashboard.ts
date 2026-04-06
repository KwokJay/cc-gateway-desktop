import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigSnapshot, DesktopSettings } from '../api';
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

const getOauthState = (oauth: string | undefined): HealthState => {
  if (!oauth) return 'unknown';
  const lower = oauth.toLowerCase();
  if (lower.includes('invalid') || lower.includes('error') || lower.includes('fail')) return 'danger';
  if (lower.includes('expired') || lower.includes('refresh')) return 'warning';
  if (lower.includes('valid') || lower.includes('ok')) return 'healthy';
  return 'unknown';
};

const getConfiguredState = (configured: boolean): HealthState => (configured ? 'healthy' : 'warning');

export const useHealthDashboard = (
  status: DaemonStatus,
  health: DaemonHealth | null,
  config: ConfigSnapshot | null,
  settings: DesktopSettings | null,
  autostartEnabled: boolean,
) => {
  const { t } = useTranslation();
  const notifiedDanger = useRef<string | null>(null);
  const hasObservedRunning = useRef<boolean>(false);

  if (status === 'running') {
    hasObservedRunning.current = true;
  }

  const categories = useMemo<HealthCategory[]>(() => {
    const summary = config?.summary;
    const configValid = !!summary && !config?.validationError;
    const oauthState = status === 'running' ? getOauthState(health?.oauth) : 'unknown';
    const boolText = (value: boolean | null | undefined) => {
      if (value === null || value === undefined) return t('status.state.unknown');
      return value ? t('common.yes') : t('common.no');
    };
    const dateText = (value: number | null | undefined) =>
      value ? new Date(value).toLocaleString() : t('common.noData');
    const rangeText = (range?: [number, number]) =>
      range ? `${range[0].toLocaleString()} - ${range[1].toLocaleString()}` : t('common.noData');
    const fallback = t('common.noData');
    const warningReason = (condition: boolean, reason: string, recommendation: string) =>
      condition ? { reason, recommendation } : {};

    const identityRewrite: HealthCategory = {
      id: 'identityRewrite',
      label: t('status.category.identityRewrite'),
      description: t('status.categoryDescription.identityRewrite'),
      overallState: configValid ? 'healthy' : config?.validationError ? 'danger' : 'unknown',
      items: [
        {
          id: 'identity_device',
          label: t('status.items.device'),
          value: summary?.identity.deviceId ?? fallback,
          state: config?.validationError ? 'danger' : summary?.identity.deviceId ? 'healthy' : 'unknown',
          ...warningReason(
            !!config?.validationError,
            config?.validationError ?? '',
            t('status.suggestions.fixConfigValidation'),
          ),
        },
        { id: 'identity_email', label: t('status.items.email'), value: summary?.identity.email ?? fallback, state: summary?.identity.email ? 'healthy' : 'unknown' },
        {
          id: 'identity_account',
          label: t('status.items.accountUuid'),
          value: summary?.identity.accountUuid ?? fallback,
          state: summary?.identity.accountUuid ? 'healthy' : 'warning',
          ...warningReason(
            !summary?.identity.accountUuid,
            t('status.reasons.missingAccountUuid'),
            t('status.suggestions.addIdentityFields'),
          ),
        },
        {
          id: 'identity_session',
          label: t('status.items.sessionId'),
          value: summary?.identity.sessionId ?? fallback,
          state: summary?.identity.sessionId ? 'healthy' : 'warning',
          ...warningReason(
            !summary?.identity.sessionId,
            t('status.reasons.missingSessionId'),
            t('status.suggestions.addIdentityFields'),
          ),
        },
        { id: 'identity_userid', label: t('status.items.userIdRewrite'), value: t('status.values.enabled'), state: 'healthy' },
        { id: 'identity_generic', label: t('status.items.genericIdentityRewrite'), value: t('status.values.enabled'), state: 'healthy' },
      ],
    };

    const ciFlags = summary?.env.ciFlags;
    const envRewrite: HealthCategory = {
      id: 'envRewrite',
      label: t('status.category.envRewrite'),
      description: t('status.categoryDescription.envRewrite'),
      overallState: !summary
        ? 'unknown'
        : summary.env.keyCount >= 40
          ? 'healthy'
          : summary.env.keyCount >= 20
            ? 'warning'
            : 'danger',
      items: [
        {
          id: 'env_source',
          label: t('status.items.envSource'),
          value: summary?.env.source ?? fallback,
          state: summary?.env.source === 'canonical-profile' ? 'healthy' : summary ? 'warning' : 'unknown',
          ...warningReason(
            !!summary && summary.env.source !== 'canonical-profile',
            t('status.reasons.inlineEnvSource'),
            t('status.suggestions.useCanonicalProfile'),
          ),
        },
        {
          id: 'env_count',
          label: t('status.items.envKeyCount'),
          value: summary ? String(summary.env.keyCount) : fallback,
          state: summary ? (summary.env.keyCount >= 40 ? 'healthy' : summary.env.keyCount >= 20 ? 'warning' : 'danger') : 'unknown',
          ...warningReason(
            !!summary && summary.env.keyCount < 40,
            t('status.reasons.envKeyCount', { count: summary?.env.keyCount ?? 0 }),
            t('status.suggestions.useCanonicalProfile'),
          ),
        },
        { id: 'env_platform', label: t('status.items.platform'), value: summary?.env.platform ?? fallback, state: summary?.env.platform ? 'healthy' : 'unknown' },
        { id: 'env_platform_raw', label: t('status.items.platformRaw'), value: summary?.env.platformRaw ?? fallback, state: summary?.env.platformRaw ? 'healthy' : 'unknown' },
        { id: 'env_arch', label: t('status.items.arch'), value: summary?.env.arch ?? fallback, state: summary?.env.arch ? 'healthy' : 'unknown' },
        { id: 'env_node', label: t('status.items.nodeVersion'), value: summary?.env.nodeVersion ?? fallback, state: summary?.env.nodeVersion ? 'healthy' : 'unknown' },
        { id: 'env_terminal', label: t('status.items.terminal'), value: summary?.env.terminal ?? fallback, state: summary?.env.terminal ? 'healthy' : 'unknown' },
        { id: 'env_pkg', label: t('status.items.packageManagers'), value: summary?.env.packageManagers ?? fallback, state: summary?.env.packageManagers ? 'healthy' : 'unknown' },
        { id: 'env_runtimes', label: t('status.items.runtimes'), value: summary?.env.runtimes ?? fallback, state: summary?.env.runtimes ? 'healthy' : 'unknown' },
        { id: 'env_ci', label: t('status.items.ciFlags'), value: ciFlags ? [`isCi=${ciFlags.isCi}`, `isClaubbit=${ciFlags.isClaubbit}`, `isClaudeCodeRemote=${ciFlags.isClaudeCodeRemote}`, `isLocalAgentMode=${ciFlags.isLocalAgentMode}`, `isConductor=${ciFlags.isConductor}`, `isGithubAction=${ciFlags.isGithubAction}`, `isClaudeCodeAction=${ciFlags.isClaudeCodeAction}`].join(', ') : fallback, state: ciFlags ? 'healthy' : 'unknown' },
        { id: 'env_deploy', label: t('status.items.deploymentEnvironment'), value: summary?.env.deploymentEnvironment ?? fallback, state: summary?.env.deploymentEnvironment ? 'healthy' : 'unknown' },
        { id: 'env_version', label: t('status.items.ccVersion'), value: summary?.env.version ?? fallback, state: summary?.env.version ? 'healthy' : 'unknown' },
      ],
    };

    const promptSanitization: HealthCategory = {
      id: 'promptSanitization',
      label: t('status.category.promptSanitization'),
      description: t('status.categoryDescription.promptSanitization'),
      overallState: summary?.promptEnv.workingDir ? 'healthy' : 'unknown',
      items: [
        { id: 'prompt_platform', label: t('status.items.platform'), value: summary?.promptEnv.platform ?? fallback, state: summary?.promptEnv.platform ? 'healthy' : 'unknown' },
        { id: 'prompt_shell', label: t('status.items.shell'), value: summary?.promptEnv.shell ?? fallback, state: summary?.promptEnv.shell ? 'healthy' : 'unknown' },
        { id: 'prompt_os', label: t('status.items.osVersion'), value: summary?.promptEnv.osVersion ?? fallback, state: summary?.promptEnv.osVersion ? 'healthy' : 'unknown' },
        { id: 'prompt_dir', label: t('status.items.workingDirectory'), value: summary?.promptEnv.workingDir ?? fallback, state: summary?.promptEnv.workingDir ? 'healthy' : 'unknown' },
        { id: 'prompt_env_block', label: t('status.items.envBlockRewrite'), value: t('status.values.enabled'), state: 'healthy' },
      ],
    };

    const billingHeader: HealthCategory = {
      id: 'billingHeader',
      label: t('status.category.billingHeader'),
      description: t('status.categoryDescription.billingHeader'),
      overallState: 'healthy',
      items: [
        { id: 'billing_strip', label: t('status.items.billingHeader'), value: t('status.values.stripped'), state: 'healthy' },
        { id: 'billing_user_agent', label: t('status.items.userAgentVersion'), value: summary?.env.version ?? fallback, state: summary?.env.version ? 'healthy' : 'unknown' },
        { id: 'billing_cache', label: t('status.items.promptCacheSharing'), value: t('status.values.enabled'), state: 'healthy' },
      ],
    };

    const processMetrics: HealthCategory = {
      id: 'processMetrics',
      label: t('status.category.processMetrics'),
      description: t('status.categoryDescription.processMetrics'),
      overallState: summary?.process.constrainedMemory ? 'healthy' : 'unknown',
      items: [
        { id: 'process_memory', label: t('status.items.constrainedMemory'), value: summary ? summary.process.constrainedMemory.toLocaleString() : fallback, state: summary?.process.constrainedMemory ? 'healthy' : 'unknown' },
        { id: 'process_rss', label: t('status.items.rssRange'), value: summary ? rangeText(summary.process.rssRange) : fallback, state: summary?.process.rssRange ? 'healthy' : 'unknown' },
        { id: 'process_heap_total', label: t('status.items.heapTotalRange'), value: summary ? rangeText(summary.process.heapTotalRange) : fallback, state: summary?.process.heapTotalRange ? 'healthy' : 'unknown' },
        { id: 'process_heap_used', label: t('status.items.heapUsedRange'), value: summary ? rangeText(summary.process.heapUsedRange) : fallback, state: summary?.process.heapUsedRange ? 'healthy' : 'unknown' },
      ],
    };

    const zeroLoginClients: HealthCategory = {
      id: 'zeroLoginClients',
      label: t('status.category.zeroLoginClients'),
      description: t('status.categoryDescription.zeroLoginClients'),
      overallState: summary ? getConfiguredState(summary.clients.length > 0) : 'unknown',
      items: [
        { id: 'clients_list', label: t('status.items.clients'), value: summary?.clients.join(', ') || fallback, state: summary?.clients.length ? 'healthy' : 'warning' },
        {
          id: 'clients_count',
          label: t('status.items.clientCount'),
          value: summary ? String(summary.clients.length) : fallback,
          state: summary?.clients.length ? 'healthy' : 'warning',
          ...warningReason(
            !!summary && summary.clients.length === 0,
            t('status.reasons.noClientsConfigured'),
            t('status.suggestions.addClientTokens'),
          ),
        },
        {
          id: 'clients_launcher',
          label: t('status.items.launcherPath'),
          value: summary?.launcher.path ?? fallback,
          state: summary?.launcher.available ? 'healthy' : 'warning',
          ...warningReason(
            !!summary && !summary.launcher.available,
            t('status.reasons.launcherMissing'),
            t('status.suggestions.installCliLauncher'),
          ),
        },
        { id: 'clients_autostart', label: t('settings.autostart'), value: boolText(autostartEnabled), state: autostartEnabled ? 'healthy' : 'unknown' },
        { id: 'clients_minimized', label: t('settings.startMinimized'), value: boolText(settings?.startMinimized), state: settings ? 'healthy' : 'unknown' },
        { id: 'clients_browser', label: t('status.items.browserOauthRequired'), value: t('common.no'), state: 'healthy' },
        { id: 'clients_shell_rc', label: t('status.items.shellRcRequired'), value: t('common.no'), state: 'healthy' },
        { id: 'clients_local_config', label: t('status.items.perClientConfigRequired'), value: t('common.no'), state: 'healthy' },
      ],
    };

    const centralizedOAuth: HealthCategory = {
      id: 'centralizedOAuth',
      label: t('status.category.centralizedOAuth'),
      description: t('status.categoryDescription.centralizedOAuth'),
      overallState: status === 'failed' ? 'danger' : summary ? oauthState : 'unknown',
      items: [
        { id: 'oauth_status', label: t('status.items.oauth'), value: health?.oauth || t('status.state.unknown'), state: oauthState },
        {
          id: 'oauth_access',
          label: t('status.items.accessTokenPresent'),
          value: boolText(summary?.oauth.accessTokenPresent),
          state: summary ? getConfiguredState(summary.oauth.accessTokenPresent) : 'unknown',
          ...warningReason(
            !!summary && !summary.oauth.accessTokenPresent,
            t('status.reasons.accessTokenMissing'),
            t('status.suggestions.loginClaude'),
          ),
        },
        {
          id: 'oauth_refresh',
          label: t('status.items.refreshTokenPresent'),
          value: boolText(summary?.oauth.refreshTokenPresent),
          state: summary ? getConfiguredState(summary.oauth.refreshTokenPresent) : 'unknown',
          ...warningReason(
            !!summary && !summary.oauth.refreshTokenPresent,
            t('status.reasons.refreshTokenMissing'),
            t('status.suggestions.loginClaude'),
          ),
        },
        {
          id: 'oauth_expires',
          label: t('status.items.expiresAt'),
          value: dateText(summary?.oauth.expiresAt),
          state: summary?.oauth.expired === null ? 'unknown' : summary?.oauth.expired ? 'warning' : 'healthy',
          ...warningReason(
            !!summary?.oauth.expired,
            t('status.reasons.oauthExpired'),
            t('status.suggestions.loginClaude'),
          ),
        },
        { id: 'oauth_gateway', label: t('status.items.gatewayRefreshControl'), value: t('status.values.enabled'), state: 'healthy' },
      ],
    };

    const instantStartup: HealthCategory = {
      id: 'instantStartup',
      label: t('status.category.instantStartup'),
      description: t('status.categoryDescription.instantStartup'),
      overallState: !summary
        ? 'unknown'
        : summary.oauth.accessTokenPresent
          ? summary.oauth.expired
            ? 'warning'
            : 'healthy'
          : 'danger',
      items: [
        { id: 'startup_access', label: t('status.items.accessTokenPresent'), value: boolText(summary?.oauth.accessTokenPresent), state: summary ? getConfiguredState(summary.oauth.accessTokenPresent) : 'unknown' },
        {
          id: 'startup_expiry',
          label: t('status.items.expiresAt'),
          value: dateText(summary?.oauth.expiresAt),
          state: summary?.oauth.expired === null ? 'unknown' : summary?.oauth.expired ? 'warning' : 'healthy',
          ...warningReason(
            !!summary?.oauth.expired,
            t('status.reasons.oauthExpired'),
            t('status.suggestions.loginClaude'),
          ),
        },
        {
          id: 'startup_mode',
          label: t('status.items.startupBehavior'),
          value: summary?.oauth.accessTokenPresent ? (summary.oauth.expired ? t('status.values.degradedStartup') : t('status.values.instantStartup')) : t('status.values.refreshRequired'),
          state: !summary ? 'unknown' : summary.oauth.expired ? 'warning' : 'healthy',
          ...warningReason(
            !!summary && !!summary.oauth.expired,
            t('status.reasons.startupDegraded'),
            t('status.suggestions.loginClaude'),
          ),
        },
      ],
    };

    const proxyAware: HealthCategory = {
      id: 'proxyAware',
      label: t('status.category.proxyAware'),
      description: t('status.categoryDescription.proxyAware'),
      overallState: summary ? 'healthy' : 'unknown',
      items: [
        { id: 'proxy_upstream', label: t('status.items.upstream'), value: summary?.upstream ?? health?.upstream ?? fallback, state: summary?.upstream || health?.upstream ? 'healthy' : 'unknown' },
        { id: 'proxy_http', label: t('status.items.httpProxy'), value: summary?.proxy.httpProxy ?? t('status.values.notConfigured'), state: summary?.proxy.httpProxy ? 'healthy' : 'unknown' },
        { id: 'proxy_https', label: t('status.items.httpsProxy'), value: summary?.proxy.httpsProxy ?? t('status.values.notConfigured'), state: summary?.proxy.httpsProxy ? 'healthy' : 'unknown' },
        { id: 'proxy_support', label: t('status.items.proxySupport'), value: t('status.values.enabled'), state: 'healthy' },
      ],
    };

    const telemetryLeakPrevention: HealthCategory = {
      id: 'telemetryLeakPrevention',
      label: t('status.category.telemetryLeakPrevention'),
      description: t('status.categoryDescription.telemetryLeakPrevention'),
      overallState: 'healthy',
      items: [
        { id: 'telemetry_fields', label: t('status.items.strippedEventFields'), value: 'baseUrl, base_url, gateway', state: 'healthy' },
        { id: 'telemetry_headers', label: t('status.items.strippedHeaders'), value: 'authorization, proxy-authorization, x-api-key, x-anthropic-billing-header', state: 'healthy' },
        { id: 'telemetry_recursive', label: t('status.items.recursiveMetadataRewrite'), value: t('status.values.enabled'), state: 'healthy' },
        { id: 'telemetry_generic', label: t('status.items.genericPayloadCoverage'), value: '/policy_limits, /settings', state: 'healthy' },
        { id: 'telemetry_logs', label: t('status.items.logPath'), value: summary?.logPath ?? '~/.ccgw/logs/desktop-daemon.log', state: 'healthy' },
      ],
    };

    return [
      identityRewrite,
      envRewrite,
      promptSanitization,
      billingHeader,
      processMetrics,
      zeroLoginClients,
      centralizedOAuth,
      instantStartup,
      proxyAware,
      telemetryLeakPrevention,
    ];
  }, [autostartEnabled, config, health, settings, status, t]);

  useEffect(() => {
    const dangerCategories = categories.filter((category) => category.overallState === 'danger');
    if (dangerCategories.length > 0) {
      const fingerprint = dangerCategories.map((category) => category.id).sort().join(',');
      if (notifiedDanger.current !== fingerprint) {
        if (hasObservedRunning.current || status === 'failed') {
          notifiedDanger.current = fingerprint;
          notifyDanger(
            t('status.dashboard'),
            `Danger detected in: ${dangerCategories.map((category) => category.label).join(', ')}`,
          ).catch(console.error);
        }
      }
    } else {
      notifiedDanger.current = null;
    }
  }, [categories, status, t]);

  return categories;
};
