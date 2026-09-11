import type { TFunction } from 'i18next';
import type { ToastShowParams } from 'react-native-toast-message';
import type { ProgramInstallResult } from '../services/programToPresets';

/**
 * The toast shown after a store program is installed. Both entry points
 * (program page, exercises library) share it so the skipped-exercise notice
 * cannot drift: the purchase sheet quotes the program's full exercise count,
 * and a movement the provider could not match is dropped from its session
 * silently unless this says so.
 */
export function programInstalledToast(
  t: TFunction,
  result: ProgramInstallResult
): ToastShowParams {
  const text1 = t('programs.purchase.added', {
    count: result.presetsCreated,
    defaultValue: '{{count}} workouts added to Programs',
    defaultValue_one: '{{count}} workout added to Programs',
    defaultValue_other: '{{count}} workouts added to Programs',
  });
  if (result.skipped.length === 0) return { type: 'success', text1 };
  return {
    type: 'info',
    text1,
    text2: t('programs.purchase.skipped', {
      count: result.skipped.length,
      defaultValue:
        "{{count}} exercises couldn't be matched and were left out",
      defaultValue_one:
        "{{count}} exercise couldn't be matched and was left out",
      defaultValue_other:
        "{{count}} exercises couldn't be matched and were left out",
    }),
    visibilityTime: 6000,
  };
}
