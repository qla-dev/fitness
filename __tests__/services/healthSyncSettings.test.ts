import {
  areAllHealthMetricsEnabled,
  enableAllHealthMetrics,
  requestAllHealthPermissions,
} from '../../src/services/healthSyncSettings';
import { requestHealthPermissions } from '../../src/services/healthConnectService';
import { HEALTH_METRICS } from '../../src/HealthMetrics';
import { WRITEBACK_METRICS } from '../../src/WritebackMetrics';

jest.mock('../../src/services/healthConnectService', () => ({
  loadHealthPreference: jest.fn().mockResolvedValue(null),
  saveHealthPreference: jest.fn().mockResolvedValue(undefined),
  requestHealthPermissions: jest.fn().mockResolvedValue(true),
  setupBackgroundDeliveryForEnabledMetrics: jest
    .fn()
    .mockResolvedValue(undefined),
  refreshSubscriptions: jest.fn(),
  startObservers: jest.fn(),
  stopObservers: jest.fn(),
}));
jest.mock('../../src/services/backgroundSyncService', () => ({
  configureBackgroundSync: jest.fn(),
  performBackgroundSync: jest.fn(),
  stopBackgroundSync: jest.fn(),
}));
jest.mock('../../src/services/autoSyncCoordinator', () => ({
  isForegroundAutoSyncWindowOpen: jest.fn(() => false),
  tryClaimAutoSync: jest.fn(() => null),
}));
jest.mock('../../src/services/storage', () => ({
  saveBackgroundSyncEnabled: jest.fn(),
}));
jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));

const mockRequest = requestHealthPermissions as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockRequest.mockResolvedValue(true);
});

describe('requestAllHealthPermissions', () => {
  it('asks for every writeback metric write permission, not just enabled ones', async () => {
    // The regression this guards: writeback metrics default to OFF, so asking
    // with the enabled-only set produced a startup sheet of read rows alone.
    // iOS then considered every displayed type answered and never asked about
    // writing again, leaving writeback authorized for nothing.
    await requestAllHealthPermissions();

    expect(mockRequest).toHaveBeenCalledTimes(1);
    const requested = mockRequest.mock.calls[0][0] as {
      accessType: string;
      recordType: string;
    }[];

    for (const metric of WRITEBACK_METRICS) {
      expect(requested).toContainEqual({
        accessType: 'write',
        recordType: metric.recordType,
      });
    }
  });

  it('still asks for every read metric permission', async () => {
    await requestAllHealthPermissions();
    const requested = mockRequest.mock.calls[0][0];

    for (const permission of HEALTH_METRICS.flatMap((m) => m.permissions)) {
      expect(requested).toContainEqual(permission);
    }
  });

  it('does not enable writeback as a side effect of asking', async () => {
    // Permission and opt-in are separate: the sheet must not turn the feature on.
    const { saveHealthPreference } = jest.requireMock(
      '../../src/services/healthConnectService'
    );
    await requestAllHealthPermissions();
    expect(saveHealthPreference).not.toHaveBeenCalled();
  });

  it('reports failure instead of throwing when the sheet errors', async () => {
    mockRequest.mockRejectedValue(new Error('denied'));
    await expect(requestAllHealthPermissions()).resolves.toBe(false);
  });
});

describe('enableAllHealthMetrics', () => {
  const savePref = () =>
    jest.requireMock('../../src/services/healthConnectService')
      .saveHealthPreference as jest.Mock;

  it('turns writeback on alongside the read metrics', async () => {
    await expect(enableAllHealthMetrics()).resolves.toBe(true);

    const saved = Object.fromEntries(
      savePref().mock.calls.map(([key, value]: [string, boolean]) => [
        key,
        value,
      ])
    );
    for (const metric of WRITEBACK_METRICS) {
      expect(saved[metric.preferenceKey]).toBe(true);
    }
    for (const metric of HEALTH_METRICS) {
      expect(saved[metric.preferenceKey]).toBe(true);
    }
  });

  it('enables nothing when the permission request is refused', async () => {
    mockRequest.mockResolvedValue(false);
    await expect(enableAllHealthMetrics()).resolves.toBe(false);
    expect(savePref()).not.toHaveBeenCalled();
  });
});

describe('areAllHealthMetricsEnabled', () => {
  const loadPref = () =>
    jest.requireMock('../../src/services/healthConnectService')
      .loadHealthPreference as jest.Mock;

  const prefs = (values: Record<string, boolean>) =>
    loadPref().mockImplementation((key: string) =>
      Promise.resolve(values[key] ?? false)
    );

  const allReadOn = () =>
    Object.fromEntries(HEALTH_METRICS.map((m) => [m.preferenceKey, true]));
  const allWriteOn = () =>
    Object.fromEntries(WRITEBACK_METRICS.map((m) => [m.preferenceKey, true]));

  it('is true only when both directions are fully on', async () => {
    prefs({ ...allReadOn(), ...allWriteOn() });
    await expect(areAllHealthMetricsEnabled()).resolves.toBe(true);
  });

  it('is false when a writeback switch is off, so startup re-offers the screen', async () => {
    // The regression this guards: with writeback ignored here, a user whose
    // diary never reached Apple Health counted as fully set up and was never
    // shown the screen that fixes it.
    prefs({
      ...allReadOn(),
      ...allWriteOn(),
      [WRITEBACK_METRICS[0].preferenceKey]: false,
    });
    await expect(areAllHealthMetricsEnabled()).resolves.toBe(false);
  });

  it('is false when a read metric is off', async () => {
    prefs({
      ...allReadOn(),
      ...allWriteOn(),
      [HEALTH_METRICS[0].preferenceKey]: false,
    });
    await expect(areAllHealthMetricsEnabled()).resolves.toBe(false);
  });
});
