import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { signInWithApple } from '../services/online/account';
import { syncOnline, useOnlineSync } from '../services/online/sync';
import { queryClient } from './queryClient';
import { addLog } from '../services/LogService';

/**
 * Sign in with Apple and the sync that follows it, shared by the account
 * sheet and the Online sync screen so both buttons behave the same.
 */
export function useAppleSignIn(onSignedIn?: () => void) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);
  const signIn = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await signInWithApple();
      onSignedIn?.();
      // Authentication is complete. Optional sync must not hold anything open.
      void (async () => {
        if (useOnlineSync.getState().enabled) await syncOnline();
        await queryClient.invalidateQueries();
      })().catch((failure: unknown) => {
        addLog('[OnlineAccount] Post-sign-in sync failed', 'WARNING', [
          String(failure),
        ]);
      });
    } catch (failure: unknown) {
      if (!(
        failure &&
        typeof failure === 'object' &&
        'code' in failure &&
        failure.code === 'ERR_REQUEST_CANCELED'
      ))
        setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  return { available, busy, error, signIn };
}
