import * as SecureStore from 'expo-secure-store';
import * as AppleAuthentication from 'expo-apple-authentication';
import { create } from 'zustand';
import { Platform } from 'react-native';

export type OnlineAccount = {
  id: string;
  name: string;
  ai_coins: number;
  /** How this account signs in; the email is what Apple verified, if sent. */
  sign_in?: {
    provider: 'apple';
    email: string | null;
    private_email: boolean;
    connected_at?: string | null;
  };
};
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

export async function updateOnlineAccount(user: OnlineAccount): Promise<void> {
  const current = useOnlineAccount.getState().session;
  if (!current) return;
  const session = { ...current, user };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  useOnlineAccount.setState({ session });
}

export async function signInWithApple(): Promise<boolean> {
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
  const result = await onlineRequest<Session & { registered: boolean }>(
    '/auth/apple',
    {
      identity_token: credential.identityToken,
      challenge_id: challenge.id,
      name: credential.fullName
        ? AppleAuthentication.formatFullName(credential.fullName)
        : null,
    },
    false
  );
  const session = { token: result.token, user: result.user };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  useOnlineAccount.setState({ session });
  return result.registered;
}

export async function signOutOnline(): Promise<void> {
  await onlineRequest('/session', undefined, true, 'DELETE');
  await SecureStore.deleteItemAsync(SESSION_KEY);
  useOnlineAccount.setState({ session: null });
}
