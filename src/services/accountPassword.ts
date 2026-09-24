import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * The account password, kept on the device only.
 *
 * Never in the profile record: that is one JSON value in AsyncStorage, in the
 * clear. Only a SHA-256 hash is written, and only to SecureStore (the
 * Keychain / Keystore), where the API keys already live.
 */
const PASSWORD_HASH_KEY = 'qlafit.accountPasswordHash';

export const PASSWORD_MIN_LENGTH = 8;

export const isValidPassword = (password: string): boolean =>
  password.length >= PASSWORD_MIN_LENGTH;

const hash = (password: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);

export async function hasAccountPassword(): Promise<boolean> {
  return (await SecureStore.getItemAsync(PASSWORD_HASH_KEY)) != null;
}

export async function setAccountPassword(password: string): Promise<void> {
  await SecureStore.setItemAsync(PASSWORD_HASH_KEY, await hash(password));
}
