import { render, screen, renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useHealthDashboard } from './useHealthDashboard';
import { StatusTab } from './StatusTab';
import { notifyDanger } from './notifications';
import { DaemonHealth, DaemonStatus } from '../App';

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

  it('renders categories and detail panel correctly', () => {
    render(<StatusTab status="running" health={healthyHealth} loading={false} error={null} onToggle={vi.fn()} onRefresh={vi.fn()} />);
    
    // Left rail should have categories (using the translation keys as fallback)
    expect(screen.getAllByText('status.category.daemon').length).toBeGreaterThan(0);
    expect(screen.getAllByText('status.category.auth').length).toBeGreaterThan(0);
    
    expect(screen.getByText('status.items.status')).toBeInTheDocument();
  });

  it('shows explicit state markers on items', () => {
    render(<StatusTab status="running" health={healthyHealth} loading={false} error={null} onToggle={vi.fn()} onRefresh={vi.fn()} />);
    // healthy marker text from our fallback translation
    expect(screen.getAllByText('status.state.healthy').length).toBeGreaterThan(0);
  });

  it('stopped state does not notify danger', () => {
    renderHook(() => useHealthDashboard('stopped', null));
    expect(notifyDanger).not.toHaveBeenCalled();
  });

  it('danger transition notifies once, repeated does not', () => {
    const { rerender } = renderHook(
      ({ status, health }) => useHealthDashboard(status, health),
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
      ({ status, health }) => useHealthDashboard(status, health),
      { initialProps: { status: 'running' as DaemonStatus, health: dangerHealth as DaemonHealth | null } }
    );
    
    expect(notifyDanger).toHaveBeenCalledTimes(1);
    
    // Rerender same
    rerender({ status: 'running', health: dangerHealth });
    expect(notifyDanger).toHaveBeenCalledTimes(1);
  });
});
