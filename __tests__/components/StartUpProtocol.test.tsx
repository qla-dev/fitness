import React from 'react';
import { Platform } from 'react-native';
import { act, render } from '@testing-library/react-native';
import StartUpProtocol from '../../src/components/StartUpProtocol';
import { useProfileSetup } from '../../src/hooks/useProfileSetup';
import {
  areAllHealthMetricsEnabled,
  enableAllHealthMetrics,
  isHealthStartupConfirmed,
  requestAllHealthPermissions,
} from '../../src/services/healthSyncSettings';
import { loadSyncOnOpenEnabled } from '../../src/services/storage';
import { navigationRef } from '../../src/components/ActiveWorkoutBar';

jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  navigationRef: {
    isReady: () => true,
    getRootState: () => ({ index: 0, routes: [{ name: 'Tabs' }] }),
    addListener: () => () => {},
    navigate: jest.fn(),
  },
}));

jest.mock('../../src/hooks/useServerConnection', () => ({
  useServerConnection: () => ({ isConnected: true }),
}));

jest.mock('../../src/hooks/useProfileSetup', () => ({
  useProfileSetup: jest.fn(),
}));

jest.mock('../../src/services/healthConnectService', () => ({
  initHealthConnect: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/healthSyncSettings', () => ({
  areAllHealthMetricsEnabled: jest.fn(),
  enableAllHealthMetrics: jest.fn().mockResolvedValue(true),
  isHealthStartupConfirmed: jest.fn(),
  requestAllHealthPermissions: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/storage', () => ({
  loadSyncOnOpenEnabled: jest.fn(),
}));

const navigate = navigationRef.navigate as jest.Mock;
const mockedUseProfileSetup = useProfileSetup as jest.Mock;
const mockedAllEnabled = areAllHealthMetricsEnabled as jest.Mock;
const mockedConfirmed = isHealthStartupConfirmed as jest.Mock;
const mockedSyncOnOpen = loadSyncOnOpenEnabled as jest.Mock;

async function flush() {
  await act(async () => {
    await jest.runAllTimersAsync();
  });
}

describe('StartUpProtocol', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Platform.OS = 'ios';
    mockedConfirmed.mockResolvedValue(false);
    mockedSyncOnOpen.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = originalOS;
  });

  it('runs the wizard, then the Health sheet, then the health check on iOS', async () => {
    let closeWizard: () => void = () => {};
    mockedUseProfileSetup.mockReturnValue({
      ready: true,
      isComplete: false,
      isError: false,
      openWizard: jest.fn((show: () => void, onClose: () => void) => {
        closeWizard = onClose;
        show();
        return true;
      }),
    });
    mockedAllEnabled.mockResolvedValue(false);

    render(<StartUpProtocol />);
    await flush();
    expect(navigate).toHaveBeenCalledWith('SetupWizard');
    expect(enableAllHealthMetrics).not.toHaveBeenCalled();

    closeWizard();
    await flush();
    expect(enableAllHealthMetrics).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenLastCalledWith('AppleHealthCheck');
  });

  it('only re-asks for Health access when setup and health are both done', async () => {
    const openWizard = jest.fn();
    mockedUseProfileSetup.mockReturnValue({
      ready: true,
      isComplete: true,
      isError: false,
      openWizard,
    });
    mockedAllEnabled.mockResolvedValue(true);
    mockedConfirmed.mockResolvedValue(true);
    mockedSyncOnOpen.mockResolvedValue(true);

    render(<StartUpProtocol />);
    await flush();
    expect(openWizard).not.toHaveBeenCalled();
    // The native sheet is requested on every start, without re-enabling metrics.
    expect(requestAllHealthPermissions).toHaveBeenCalledTimes(1);
    expect(enableAllHealthMetrics).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('offers both Health steps again until the health check was acted on', async () => {
    mockedUseProfileSetup.mockReturnValue({
      ready: true,
      isComplete: true,
      isError: false,
      openWizard: jest.fn(),
    });
    // Metrics were saved on by an earlier run, but the user never synced,
    // imported, or turned on automatic sync on the health check screen.
    mockedAllEnabled.mockResolvedValue(true);
    mockedConfirmed.mockResolvedValue(false);
    mockedSyncOnOpen.mockResolvedValue(true);

    render(<StartUpProtocol />);
    await flush();
    expect(enableAllHealthMetrics).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('AppleHealthCheck');
  });

  it('keeps showing the health check while sync on open is off', async () => {
    mockedUseProfileSetup.mockReturnValue({
      ready: true,
      isComplete: true,
      isError: false,
      openWizard: jest.fn(),
    });
    mockedAllEnabled.mockResolvedValue(true);
    mockedConfirmed.mockResolvedValue(true);
    mockedSyncOnOpen.mockResolvedValue(false);

    render(<StartUpProtocol />);
    await flush();
    expect(navigate).toHaveBeenCalledWith('AppleHealthCheck');
  });

  it('only offers the wizard on Android', async () => {
    Platform.OS = 'android';
    mockedUseProfileSetup.mockReturnValue({
      ready: true,
      isComplete: false,
      isError: false,
      openWizard: jest.fn((show: () => void, onClose: () => void) => {
        show();
        onClose();
        return true;
      }),
    });
    mockedAllEnabled.mockResolvedValue(false);

    render(<StartUpProtocol />);
    await flush();
    expect(navigate).toHaveBeenCalledWith('SetupWizard');
    expect(enableAllHealthMetrics).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalledWith('AppleHealthCheck');
  });
});
