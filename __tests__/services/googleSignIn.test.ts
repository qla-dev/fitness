import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  googleSignInSupported,
  signInWithGoogle,
  SignInCancelledError,
  useOnlineAccount,
} from '../../src/services/online/account';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
    signOut: jest.fn(async () => undefined),
  },
  isSuccessResponse: (response: { type: string }) =>
    response.type === 'success',
}));

const WEB = 'web-client.apps.googleusercontent.com';
const IOS = 'ios-client.apps.googleusercontent.com';
const setPlatform = (os: 'ios' | 'android') =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
const setExtra = (extra: Record<string, string>) => {
  (Constants as { expoConfig: unknown }).expoConfig = { extra };
};

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('ios');
  setExtra({ googleIosClientId: IOS, googleWebClientId: WEB });
  useOnlineAccount.setState({ session: null });
});

it('offers Google where the platform has the client it needs', () => {
  expect(googleSignInSupported()).toBe(true);
  setExtra({ googleWebClientId: WEB });
  expect(googleSignInSupported()).toBe(false);
  setPlatform('android');
  expect(googleSignInSupported()).toBe(true);
  setExtra({ googleIosClientId: IOS });
  expect(googleSignInSupported()).toBe(false);
});

it('hands the Google ID token to the backend and keeps the session', async () => {
  jest.mocked(GoogleSignin.signIn).mockResolvedValue({
    type: 'success',
    data: { idToken: 'google-id-token' },
  } as never);
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        token: 't',
        registered: true,
        user: { id: '7', name: 'Runner', ai_coins: 100 },
      },
    }),
  }));
  global.fetch = fetchMock as never;
  await expect(signInWithGoogle()).resolves.toBe(true);
  expect(GoogleSignin.configure).toHaveBeenCalledWith({
    webClientId: WEB,
    iosClientId: IOS,
  });
  const [url, init] = fetchMock.mock.calls[0] as unknown as [
    string,
    { body: string },
  ];
  expect(url).toMatch(/\/auth\/google$/);
  expect(JSON.parse(init.body)).toEqual({ id_token: 'google-id-token' });
  expect(useOnlineAccount.getState().session?.token).toBe('t');
});

it('treats a dismissed Google sheet as a cancel', async () => {
  jest
    .mocked(GoogleSignin.signIn)
    .mockResolvedValue({ type: 'cancelled', data: null } as never);
  await expect(signInWithGoogle()).rejects.toBeInstanceOf(
    SignInCancelledError
  );
});
