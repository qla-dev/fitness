type Bridge =
  typeof import('../../src/services/CalorieWidgetBridge').CalorieWidgetBridge;

/**
 * Loads the bridge fresh, since it resolves the native module at import time.
 * React Native is required inside the isolated registry so the module the
 * bridge reads is the one set up here.
 */
function loadBridge(nativeModule: Record<string, unknown> | undefined): Bridge {
  let bridge: Bridge | undefined;
  jest.isolateModules(() => {
    const rn = require('react-native') as typeof import('react-native');
    Object.defineProperty(rn.Platform, 'OS', {
      get: () => 'android',
      configurable: true,
    });
    (rn.NativeModules as Record<string, unknown>).CalorieWidget = nativeModule;
    bridge = (
      require('../../src/services/CalorieWidgetBridge') as {
        CalorieWidgetBridge: Bridge;
      }
    ).CalorieWidgetBridge;
  });
  return bridge as Bridge;
}

describe('CalorieWidgetBridge', () => {
  it('forwards the activity snapshot and reload to the native module', async () => {
    const native = {
      setActivitySnapshot: jest.fn(() => Promise.resolve()),
      reloadActivityWidget: jest.fn(() => Promise.resolve()),
    };
    const bridge = loadBridge(native);

    await bridge.setActivitySnapshot('{"move":1}');
    await bridge.reloadActivityWidget();

    expect(native.setActivitySnapshot).toHaveBeenCalledWith('{"move":1}');
    expect(native.reloadActivityWidget).toHaveBeenCalledTimes(1);
  });

  it('skips the activity widget on a native build that predates it', async () => {
    // A JS bundle newer than the installed native build: the module exists
    // but has no activity methods, which must not throw.
    const native = {
      setCalorieSnapshot: jest.fn(() => Promise.resolve()),
      reloadWidget: jest.fn(() => Promise.resolve()),
    };
    const bridge = loadBridge(native);

    await expect(bridge.setActivitySnapshot('{}')).resolves.toBeUndefined();
    await expect(bridge.reloadActivityWidget()).resolves.toBeUndefined();
    expect(bridge.isAvailable).toBe(true);
  });

  it('is a no-op without the native module', async () => {
    const bridge = loadBridge(undefined);

    await expect(bridge.setActivitySnapshot('{}')).resolves.toBeUndefined();
    await expect(bridge.reloadMacroWidget()).resolves.toBeUndefined();
    expect(bridge.isAvailable).toBe(false);
  });
});
