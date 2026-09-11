import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveServerConfig } from './storage';
import { isLocalDataMode } from './dataMode';

export interface ProgramAccess {
  programId: string;
  startedAt: string;
  expiresAt: string;
}

export async function programAccessScope(): Promise<string> {
  if (isLocalDataMode()) return 'local';
  const config = await getActiveServerConfig();
  if (!config) throw new Error('No active server for program access');
  return config.id;
}

export function createProgramAccess(
  programId: string,
  weeks: number,
  start = new Date()
): ProgramAccess {
  const end = new Date(start);
  end.setDate(end.getDate() + weeks * 7 + 5);
  return {
    programId,
    startedAt: start.toISOString(),
    expiresAt: end.toISOString(),
  };
}

const key = (scope: string, presetId: string | number) =>
  `@Fitness/program-access/${encodeURIComponent(scope)}/${presetId}`;

export async function saveProgramAccess(
  scope: string,
  presetId: string | number,
  access: ProgramAccess
) {
  await AsyncStorage.setItem(key(scope, presetId), JSON.stringify(access));
}

export async function readProgramAccess(
  scope: string,
  presetId: string | number
): Promise<ProgramAccess | null> {
  const raw = await AsyncStorage.getItem(key(scope, presetId));
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== 'object' ||
    !('expiresAt' in value) ||
    typeof value.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(value.expiresAt))
  )
    return null;
  return value as ProgramAccess;
}

// ── Installed-program registry ────────────────────────────────────────────
// Access records above are keyed by preset, which answers "how long does this
// workout stay unlocked" but not "has this program been added already". The
// Store had no answer to that, so Start could be tapped twice and install two
// full copies. One key per scope holds the ids of every program installed.

const installedKey = (scope: string) =>
  `@Fitness/program-installed/${encodeURIComponent(scope)}`;

export async function readInstalledPrograms(scope: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(installedKey(scope));
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string')
    : [];
}

export async function markProgramInstalled(scope: string, programId: string) {
  const current = await readInstalledPrograms(scope);
  if (current.includes(programId)) return;
  await AsyncStorage.setItem(
    installedKey(scope),
    JSON.stringify([...current, programId])
  );
}
