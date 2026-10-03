import * as SplashScreen from 'expo-splash-screen';
import { addLog } from './LogService';

/**
 * The longest the splash may wait for the first screen. Only a navigator that
 * never reports ready reaches it; it is there so the splash can never stick.
 */
export const SPLASH_FALLBACK_MS = 3000;

let resolveShown!: () => void;
const shown = new Promise<void>((resolve) => {
  resolveShown = resolve;
});
let revealed = false;

/**
 * Drops the splash straight onto the first screen.
 *
 * Called once that screen has drawn, not when the route is merely chosen:
 * hiding earlier uncovered the bare native window — a white screen for as
 * long as the first render took, which after a long break was seconds,
 * because every catch-up sync started in the same moment.
 */
export function revealFirstScreen(): void {
  if (revealed) return;
  revealed = true;
  resolveShown();
  SplashScreen.hideAsync().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    addLog(`[App] Failed to hide splash screen: ${message}`, 'ERROR');
  });
}

/**
 * Resolves once the first screen is showing and the JS thread has gone idle.
 *
 * Startup work that is not needed to draw that screen — catch-up syncs,
 * observers, log pruning — waits on this, so it runs behind the first screen
 * instead of in front of it. The idle timeout keeps it from waiting forever
 * on a thread that never goes idle.
 */
export function afterFirstScreen(): Promise<void> {
  return shown.then(
    () =>
      new Promise<void>((resolve) => {
        requestIdleCallback(() => resolve(), { timeout: 1000 });
      })
  );
}
