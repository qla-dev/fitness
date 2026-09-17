import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { navigationRef as rootNavigationRef } from './ActiveWorkoutBar';
import { useServerConnection } from '../hooks/useServerConnection';
import { useProfileSetup } from '../hooks/useProfileSetup';
import { initHealthConnect } from '../services/healthConnectService';
import {
  areAllHealthMetricsEnabled,
  enableAllHealthMetrics,
  isHealthStartupConfirmed,
  requestAllHealthPermissions,
} from '../services/healthSyncSettings';
import { loadSyncOnOpenEnabled } from '../services/storage';
import { addLog } from '../services/LogService';
import { getErrorMessage } from '../utils/errors';

/**
 * Lets a dismissing modal finish before the next thing is presented; iOS drops
 * a presentation (including the system Health sheet) that starts mid-dismiss.
 */
const MODAL_SETTLE_MS = 600;
const settle = () =>
  new Promise<void>((resolve) => setTimeout(resolve, MODAL_SETTLE_MS));

function isOnTabs() {
  if (!rootNavigationRef.isReady()) return false;
  const state = rootNavigationRef.getRootState();
  return state?.routes[state.index]?.name === 'Tabs';
}

/**
 * Runs once each time the app starts, as soon as the user reaches the tabs
 * with a working server connection, and walks through up to three steps:
 *
 * 1. The personal setup wizard, while any question is still unanswered.
 * 2. iOS only, on every start: the system Apple Health access sheet.
 * 3. Straight after it, the AppleHealthCheck sync settings screen, until every
 *    health metric is enabled, sync on open is on, and the user has acted on
 *    that screen. While any of those is missing, the metrics are also switched
 *    back on together with the sheet request.
 *
 * Headless: it renders nothing and drives the root navigator.
 */
export default function StartUpProtocol() {
  const { isConnected } = useServerConnection();
  const profile = useProfileSetup(isConnected);
  const [onTabs, setOnTabs] = useState(isOnTabs);
  const started = useRef(false);

  // Onboarding can hand over to the tabs mid-session, so follow the root route.
  useEffect(
    () => rootNavigationRef.addListener('state', () => setOnTabs(isOnTabs())),
    []
  );

  const profileSettled = profile.ready || profile.isError;

  useEffect(() => {
    if (started.current || !onTabs || !isConnected || !profileSettled) return;
    started.current = true;

    const run = async () => {
      if (profile.ready && !profile.isComplete) {
        const opened = await new Promise<boolean>((resolve) => {
          if (
            !profile.openWizard(
              () => rootNavigationRef.navigate('SetupWizard'),
              () => resolve(true)
            )
          )
            resolve(false);
        });
        if (opened) await settle();
      }

      if (Platform.OS !== 'ios') return;
      if (!(await initHealthConnect())) return;
      const [allEnabled, confirmed, syncOnOpen] = await Promise.all([
        areAllHealthMetricsEnabled(),
        isHealthStartupConfirmed(),
        loadSyncOnOpenEnabled(),
      ]);
      const healthSetUp = allEnabled && confirmed && syncOnOpen;

      // The Health sheet is requested on every start. iOS only presents it for
      // data types the user has not answered yet, so once everything has an
      // answer this returns without showing anything.
      if (healthSetUp) {
        await requestAllHealthPermissions();
        return;
      }
      await enableAllHealthMetrics();
      await settle();
      rootNavigationRef.navigate('AppleHealthCheck');
    };

    run().catch((error) => {
      addLog(
        `[StartUpProtocol] Startup protocol failed: ${getErrorMessage(error)}`,
        'ERROR'
      );
    });
  }, [onTabs, isConnected, profileSettled, profile]);

  return null;
}
