import { useEffect, useState } from 'react';
import {
  loadOnlineAccount,
  useOnlineAccount,
} from '../services/online/account';

import { initializeAppLanguage } from '../localization';
import { addLog } from '../services/LogService';
import { localApiFetch } from '../services/local/localApi';
import { revealFirstScreen, SPLASH_FALLBACK_MS } from '../services/startupGate';

export type BootstrapRoute = 'Tabs' | 'OnlineAccount';

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
      // diary must never block language startup.
      try {
        await initializeAppLanguage();
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        addLog(`[App] Failed to initialize app language: ${message}`, 'ERROR');
      }

      if (cancelled) return;

      try {
        await localApiFetch({ endpoint: '/api/user-preferences' });
        if (cancelled) return;
        await loadOnlineAccount();
        if (cancelled) return;
        const route: BootstrapRoute = useOnlineAccount.getState().session
          ? 'Tabs'
          : 'OnlineAccount';
        setInitialRoute(route);
        setLinkingEnabled(route === 'Tabs');
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        addLog(
          `[App] Failed to initialize diary or account on startup: ${message}`,
          'ERROR'
        );
        setInitialRoute('Tabs');
        setLinkingEnabled(true);
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
