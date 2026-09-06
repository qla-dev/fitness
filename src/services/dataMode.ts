import Constants from 'expo-constants';

/** Build configuration selects the adapter; local data never falls through to HTTP. */
export const isLocalDataMode = (): boolean =>
  Constants.expoConfig?.extra?.dataMode === 'local';
