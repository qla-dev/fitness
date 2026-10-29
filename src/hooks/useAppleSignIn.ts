import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  googleSignInSupported,
  signInWithApple,
  signInWithGoogle,
  SignInCancelledError,
} from '../services/online/account';
import { syncOnline, useOnlineSync } from '../services/online/sync';
import { queryClient } from './queryClient';
import { addLog } from '../services/LogService';

const cancelled = (failure: unknown) =>
  failure instanceof SignInCancelledError ||
  (!!failure &&
    typeof failure === 'object' &&
    'code' in failure &&
    // Apple's cancel, and Google's when its sheet is dismissed.
    (failure.code === 'ERR_REQUEST_CANCELED' ||
      failure.code === 'SIGN_IN_CANCELLED'));

/**
 * One provider's sign-in and the sync that follows it, shared by the account
 * sheet and the Online sync screen so every button behaves the same.
 */
function useProviderSignIn(
  available: boolean,
  run: () => Promise<unknown>,
  onSignedIn?: () => void
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const signIn = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await run();
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
      if (!cancelled(failure))
        setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  return { available, busy, error, signIn };
}

/** Sign in with Apple, where the device offers it. */
export function useAppleSignIn(onSignedIn?: () => void) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);
  return useProviderSignIn(available, signInWithApple, onSignedIn);
}

/** Sign in with Google, when this build carries the iOS client ID. */
export function useGoogleSignIn(onSignedIn?: () => void) {
  return useProviderSignIn(
    googleSignInSupported(),
    signInWithGoogle,
    onSignedIn
  );
}
