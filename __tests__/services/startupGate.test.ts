// React Native provides this; Jest's environment does not.
global.requestIdleCallback = ((callback: () => void) =>
  setTimeout(callback, 0)) as unknown as typeof requestIdleCallback;

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../src/services/LogService', () => ({
  addLog: jest.fn(),
}));

// Module state: each test gets a fresh gate.
const load = () => {
  let gate!: typeof import('../../src/services/startupGate');
  let splash!: typeof import('expo-splash-screen');
  let log!: typeof import('../../src/services/LogService');
  jest.isolateModules(() => {
    gate = require('../../src/services/startupGate');
    splash = require('expo-splash-screen');
    log = require('../../src/services/LogService');
  });
  return { gate, splash, log };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

it('holds startup work until the first screen is shown and the thread is idle', async () => {
  const { gate } = load();
  const work = jest.fn();
  void gate.afterFirstScreen().then(work);

  await flush();
  expect(work).not.toHaveBeenCalled();

  gate.revealFirstScreen();
  await new Promise((resolve) => setTimeout(resolve, 1100));
  expect(work).toHaveBeenCalledTimes(1);
});

it('hides the splash once, however many times the first screen reports', () => {
  const { gate, splash } = load();
  gate.revealFirstScreen();
  gate.revealFirstScreen();
  expect(splash.hideAsync).toHaveBeenCalledTimes(1);
});

it('logs a splash that fails to hide and still lets startup work run', async () => {
  const { gate, splash, log } = load();
  jest.mocked(splash.hideAsync).mockRejectedValueOnce(new Error('gone'));
  const work = jest.fn();
  void gate.afterFirstScreen().then(work);

  gate.revealFirstScreen();
  await new Promise((resolve) => setTimeout(resolve, 1100));
  expect(log.addLog).toHaveBeenCalledWith(
    expect.stringContaining('Failed to hide splash screen'),
    'ERROR'
  );
  expect(work).toHaveBeenCalledTimes(1);
});
