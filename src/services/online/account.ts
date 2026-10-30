import * as SecureStore from 'expo-secure-store';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { create } from 'zustand';
import { Platform } from 'react-native';
import type { TFunction } from 'i18next';

export type OnlineAccount = {
  id: string;
  name: string;
  ai_coins: number;
  /**
   * Today's free MarkAI replies, spent before coins. Missing on a session
   * saved before the backend sent it.
   */
  free_messages?: { limit: number; used: number };
  /** The first sign-in method; the email is what the provider verified. */
  sign_in?: SignInMethod | null;
  /** Every sign-in method linked to the account. Missing on older sessions. */
  sign_in_methods?: SignInMethod[];
};

export type SignInProvider = 'apple' | 'google';
export type SignInMethod = {
  provider: SignInProvider;
  email: string | null;
  private_email: boolean;
  connected_at?: string | null;
};

/** The account's linked methods, from either field the server has sent. */
export const signInMethods = (user: OnlineAccount): SignInMethod[] =>
  user.sign_in_methods ?? (user.sign_in ? [user.sign_in] : []);
const SESSION_KEY = 'qla.online.session';
const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || 'https://fit.qla.dev/endpoints/api'
).replace(/\/$/, '');
type Session = { token: string; user: OnlineAccount };
export const useOnlineAccount = create<{
  session: Session | null;
  ready: boolean;
}>(() => ({ session: null, ready: false }));
let loading: Promise<void> | undefined;

export function loadOnlineAccount(): Promise<void> {
  if (!loading)
    loading = (async () => {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      const session = raw ? (JSON.parse(raw) as Session) : null;
      useOnlineAccount.setState({ session, ready: true });
    })().catch((error: unknown) => {
      loading = undefined;
      throw error;
    });
  return loading;
}

export class OnlineError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export async function onlineRequest<T>(
  path: string,
  body?: unknown,
  authenticated = true,
  method?: string
): Promise<T> {
  await loadOnlineAccount();
  const token = useOnlineAccount.getState().session?.token;
  if (authenticated && !token)
    throw new OnlineError(401, 'Sign in to continue.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 204) return undefined as T;
    if (response.status === 401 && authenticated) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      useOnlineAccount.setState({ session: null });
    }
    const result = (await response.json()) as { data: T; message?: string };
    if (!response.ok)
      throw new OnlineError(
        response.status,
        result.message || 'The online service is unavailable.'
      );
    return result.data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Re-reads the signed-in account, for counts the saved session can hold from
 * an earlier day (today's free MarkAI messages). Failures keep the saved one.
 */
export async function refreshOnlineAccount(): Promise<void> {
  if (!useOnlineAccount.getState().session) return;
  try {
    await updateOnlineAccount(await onlineRequest<OnlineAccount>('/account'));
  } catch {
    // Offline or signed out meanwhile: the saved account still stands.
  }
}

export async function updateOnlineAccount(user: OnlineAccount): Promise<void> {
  const current = useOnlineAccount.getState().session;
  if (!current) return;
  const session = { ...current, user };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  useOnlineAccount.setState({ session });
}

/** Apple's identity token for a server challenge, and the name Apple shares. */
async function appleCredential() {
  if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync()))
    throw new Error('Apple sign-in is available on supported Apple devices.');
  const challenge = await onlineRequest<{ id: string; nonce: string }>(
    '/auth/apple/challenge',
    {},
    false
  );
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: challenge.nonce,
  });
  if (!credential.identityToken)
    throw new Error('Apple did not return an identity token.');
  return {
    identity_token: credential.identityToken,
    challenge_id: challenge.id,
    name: credential.fullName
      ? AppleAuthentication.formatFullName(credential.fullName)
      : null,
  };
}

export async function signInWithApple(): Promise<boolean> {
  const result = await onlineRequest<Session & { registered: boolean }>(
    '/auth/apple',
    await appleCredential(),
    false
  );
  const session = { token: result.token, user: result.user };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  useOnlineAccount.setState({ session });
  return result.registered;
}

/** OAuth clients from app.json extra.googleAuth, through app.config.ts. */
const googleClientId = (key: 'googleIosClientId' | 'googleWebClientId') => {
  const value = Constants.expoConfig?.extra?.[key];
  return typeof value === 'string' ? value : '';
};

/**
 * iOS signs in with its own client; Android gets its ID token through the
 * web client. Without the one a platform needs, the button hides.
 */
export const googleSignInSupported = () =>
  Platform.OS === 'ios'
    ? googleClientId('googleIosClientId') !== ''
    : Platform.OS === 'android' && googleClientId('googleWebClientId') !== '';

/**
 * Loaded on first use, so a build without the native module (an older dev
 * client) still starts; only the Google button would fail.
 */
const googleSignInModule = () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');

export class SignInCancelledError extends Error {
  constructor() {
    super('Sign-in cancelled.');
    this.name = 'SignInCancelledError';
  }
}

/** Google's ID token, after the account chooser. */
async function googleIdToken(): Promise<string> {
  if (!googleSignInSupported())
    throw new Error('Google sign-in is not available in this build.');
  const { GoogleSignin, isSuccessResponse } = googleSignInModule();
  const webClientId = googleClientId('googleWebClientId');
  const iosClientId = googleClientId('googleIosClientId');
  GoogleSignin.configure({
    ...(webClientId ? { webClientId } : {}),
    ...(iosClientId ? { iosClientId } : {}),
  });
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) throw new SignInCancelledError();
  if (!response.data.idToken)
    throw new Error('Google did not return an ID token.');
  return response.data.idToken;
}

/** Signs in with Google; the backend verifies the ID token, as for Apple. */
export async function signInWithGoogle(): Promise<boolean> {
  const result = await onlineRequest<Session & { registered: boolean }>(
    '/auth/google',
    { id_token: await googleIdToken() },
    false
  );
  const session = { token: result.token, user: result.user };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  useOnlineAccount.setState({ session });
  return result.registered;
}

/**
 * Adds a sign-in method to the signed-in account, so either opens it. The
 * server refuses one that already has its own account.
 */
export async function linkSignInMethod(
  provider: SignInProvider
): Promise<void> {
  const body =
    provider === 'apple'
      ? await appleCredential()
      : { id_token: await googleIdToken() };
  await updateOnlineAccount(
    await onlineRequest<OnlineAccount>(
      `/account/sign-in-methods/${provider}`,
      body
    )
  );
}

/** Removes a sign-in method; the server keeps the account's last one. */
export async function unlinkSignInMethod(
  provider: SignInProvider
): Promise<void> {
  await updateOnlineAccount(
    await onlineRequest<OnlineAccount>(
      `/account/sign-in-methods/${provider}`,
      undefined,
      true,
      'DELETE'
    )
  );
}

export async function signOutOnline(): Promise<void> {
  await onlineRequest('/session', undefined, true, 'DELETE');
  await SecureStore.deleteItemAsync(SESSION_KEY);
  useOnlineAccount.setState({ session: null });
  // Lets the next Google sign-in offer the account chooser again.
  if (googleSignInSupported())
    void Promise.resolve()
      .then(() => googleSignInModule().GoogleSignin.signOut())
      .catch(() => undefined);
}

/**
 * What to call the row or button that opens the account screen.
 *
 * Apple sign-in is iOS-only and Google's needs a configured client, and the
 * account screen shows only what the phone offers — so on Android every one of these entry points
 * was a primary action promising a sign-in that the screen it opens then says
 * is unavailable. Off iOS it is named for where it actually leads instead.
 *
 * Takes `t` rather than reaching for the singleton, so a language switch
 * re-renders the callers that hold it.
 */
export function onlineAccountEntryLabel(t: TFunction): string {
  return Platform.OS === 'ios'
    ? t('online.signInGeneric', { defaultValue: 'Sign in' })
    : t('online.account', { defaultValue: 'Your account' });
}
