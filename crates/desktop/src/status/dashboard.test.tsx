import { render, screen, renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useHealthDashboard } from './useHealthDashboard';
import { StatusTab } from './StatusTab';
import { notifyDanger } from './notifications';
import { DaemonHealth, DaemonStatus } from '../App';
import type { ConfigSnapshot, DesktopSettings } from '../api';

// Mock dependencies
vi.mock('./notifications', () => ({
  notifyDanger: vi.fn(() => Promise.resolve())
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

describe('Status Dashboard Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const healthyHealth: DaemonHealth = {
    status: 'healthy',
    oauth: 'valid',
    canonical_device: 'dev-1',
    canonical_platform: 'mac',
    upstream: 'https://ok',
    clients: ['cli-1']
  };

  const config: ConfigSnapshot = {
    path: '/Users/test/.ccgw/config.yaml',
    exists: true,
    content: 'server:\n  port: 8443',
    validationError: null,
    summary: {
      port: 8443,
      upstream: 'https://api.anthropic.com',
      deviceId: 'dev-1',
      clients: ['cli-1'],
      identity: {
        deviceId: 'dev-1',
        email: 'user@example.com',
        accountUuid: 'account-1',
        sessionId: 'session-1',
      },
      oauth: {
        accessTokenPresent: true,
        refreshTokenPresent: true,
        expiresAt: Date.now() + 60_000,
        expired: false,
      },
      env: {
        source: 'canonical-profile',
        keyCount: 42,
        platform: 'darwin',
        platformRaw: 'darwin',
        arch: 'arm64',
        nodeVersion: '24.3.0',
        terminal: 'zsh',
        packageManagers: 'npm,pnpm',
        runtimes: 'node',
        isRunningWithBun: false,
        isClaudeAiAuth: true,
        deploymentEnvironment: 'development',
        version: '2.1.81',
        versionBase: '2.1.81',
        buildTime: '2026-01-01T00:00:00Z',
        vcs: 'git',
        ciFlags: {
          isCi: false,
          isClaubbit: false,
          isClaudeCodeRemote: false,
          isLocalAgentMode: false,
          isConductor: false,
          isGithubAction: false,
          isClaudeCodeAction: false,
        },
      },
      promptEnv: {
        platform: 'darwin',
        shell: 'zsh',
        osVersion: 'Darwin 24.4.0',
        workingDir: '/Users/canonical/project',
      },
      process: {
        constrainedMemory: 17179869184,
        rssRange: [1, 2],
        heapTotalRange: [3, 4],
        heapUsedRange: [5, 6],
      },
      logging: {
        level: 'info',
        audit: false,
      },
      canonicalProfilePath: null,
      logPath: '/Users/test/.ccgw/logs/desktop-daemon.log',
      proxy: {
        httpProxy: null,
        httpsProxy: null,
      },
      launcher: {
        available: true,
        path: '/usr/local/bin/ccg',
      },
    },
  };

  const settings: DesktopSettings = {
    startMinimized: false,
  };

  it('renders categories and detail panel correctly', () => {
    render(
      <StatusTab
        status="running"
        health={healthyHealth}
        config={config}
        settings={settings}
        autostartEnabled={true}
        loading={false}
        error={null}
        onToggle={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    
    // Left rail should have categories (using the translation keys as fallback)
    expect(screen.getAllByText('status.category.identityRewrite').length).toBeGreaterThan(0);
    expect(screen.getAllByText('status.category.envRewrite').length).toBeGreaterThan(0);
    
    expect(screen.getByText('status.items.device')).toBeInTheDocument();
  });

  it('shows explicit state markers on items', () => {
    render(
      <StatusTab
        status="running"
        health={healthyHealth}
        config={config}
        settings={settings}
        autostartEnabled={true}
        loading={false}
        error={null}
        onToggle={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    // healthy marker text from our fallback translation
    expect(screen.getAllByText('status.state.healthy').length).toBeGreaterThan(0);
  });

  it('stopped state does not notify danger', () => {
    renderHook(() => useHealthDashboard('stopped', null, config, settings, false));
    expect(notifyDanger).not.toHaveBeenCalled();
  });

  it('danger transition notifies once, repeated does not', () => {
    const { rerender } = renderHook(
      ({ status, health }) => useHealthDashboard(status, health, config, settings, false),
      { initialProps: { status: 'stopped' as DaemonStatus, health: null as DaemonHealth | null } }
    );
    expect(notifyDanger).not.toHaveBeenCalled();

    // Transition to failed (danger)
    rerender({ status: 'failed', health: null });
    expect(notifyDanger).toHaveBeenCalledTimes(1);

    // Rerender same danger
    rerender({ status: 'failed', health: null });
    expect(notifyDanger).toHaveBeenCalledTimes(1);

    // Transition out
    rerender({ status: 'running', health: healthyHealth });
    
    // Transition back to danger
    rerender({ status: 'failed', health: null });
    expect(notifyDanger).toHaveBeenCalledTimes(2);
  });

  it('danger in auth when running notifies once', () => {
    const dangerHealth = { ...healthyHealth, oauth: 'error invalid token' };
    const { rerender } = renderHook(
      ({ status, health }) => useHealthDashboard(status, health, config, settings, false),
      { initialProps: { status: 'running' as DaemonStatus, health: dangerHealth as DaemonHealth | null } }
    );
    
    expect(notifyDanger).toHaveBeenCalledTimes(1);
    
    // Rerender same
    rerender({ status: 'running', health: dangerHealth });
    expect(notifyDanger).toHaveBeenCalledTimes(1);
  });
});
