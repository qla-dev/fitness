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
