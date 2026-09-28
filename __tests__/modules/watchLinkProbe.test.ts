import { probeWatch } from '../../modules/watch-link';

jest.mock('expo-modules-core', () => {
  // Created inside the factory: the import above is hoisted past any
  // module-scope object, so the module would capture it uninitialised.
  const native: Record<string, unknown> = {};
  return { requireOptionalNativeModule: () => native, mockNative: native };
});
const mockNative: Record<string, unknown> =
  jest.requireMock('expo-modules-core').mockNative;

beforeEach(() => {
  for (const key of Object.keys(mockNative)) delete mockNative[key];
});

it('asks the native probe whether the watch answered', async () => {
  mockNative.isReachable = false;
  mockNative.probeWatch = jest.fn(async () => true);
  await expect(probeWatch()).resolves.toBe(true);
  expect(mockNative.probeWatch).toHaveBeenCalledTimes(1);
});

it('falls back to live reachability on a binary without the probe', async () => {
  mockNative.isReachable = false;
  await expect(probeWatch()).resolves.toBe(false);
  mockNative.isReachable = true;
  await expect(probeWatch()).resolves.toBe(true);
});
