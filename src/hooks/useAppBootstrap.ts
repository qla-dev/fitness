import { useEffect, useState } from 'react';
import {
  loadOnlineAccount,
  useOnlineAccount,
} from '../services/online/account';

import { initializeAppLanguage } from '../localization';
import { getActiveServerConfig } from '../services/storage';
import { addLog } from '../services/LogService';
import { isLocalDataMode } from '../services/dataMode';
import { localApiFetch } from '../services/local/localApi';
import { revealFirstScreen, SPLASH_FALLBACK_MS } from '../services/startupGate';

export type BootstrapRoute = 'Tabs' | 'Onboarding' | 'OnlineAccount';

export interface AppBootstrapResult {
  initialRoute: BootstrapRoute | null;
  linkingEnabled: boolean;
  setLinkingEnabled: (value: boolean) => void;
}

export function useAppBootstrap(): AppBootstrapResult {
  const [initialRoute, setInitialRoute] = useState<BootstrapRoute | null>(null);
  const [linkingEnabled, setLinkingEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let fallback: ReturnType<typeof setTimeout> | undefined;

    const determine = async (): Promise<void> => {
      // Language initialization and route selection are independent failure
      // domains: a broken locale must never change the route, and a missing
      // server config must never block language startup.
      try {
        await initializeAppLanguage();
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        addLog(`[App] Failed to initialize app language: ${message}`, 'ERROR');
      }

      if (cancelled) return;

      try {
        const local = isLocalDataMode();
        if (local) await localApiFetch({ endpoint: '/api/user-preferences' });
        const config = local ? null : await getActiveServerConfig();
        if (cancelled) return;

        if (local) await loadOnlineAccount();
        if (cancelled) return;
        const showAccount = local && !useOnlineAccount.getState().session;
        const route: BootstrapRoute = showAccount
          ? 'OnlineAccount'
          : local || config
            ? 'Tabs'
            : 'Onboarding';
        setInitialRoute(route);
        setLinkingEnabled(route === 'Tabs');
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        addLog(
          `[App] Failed to load active server config on startup: ${message}`,
          'ERROR'
        );
        setInitialRoute('Onboarding');
      }

      // The splash comes down when the first screen has drawn (the
      // navigator's onReady), not here: the route is only chosen, nothing is
      // on screen yet. This is the backstop if that never reports.
      if (cancelled) return;
      fallback = setTimeout(revealFirstScreen, SPLASH_FALLBACK_MS);
    };

    // determine() handles every expected failure internally, so the floating
    // promise cannot reject.
    void determine();

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, []);

  return { initialRoute, linkingEnabled, setLinkingEnabled };
}
