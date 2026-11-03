import type { TFunction } from 'i18next';
import { daysBetween } from '@workspace/shared';
import type { CyclePredictionData } from '../hooks/useCyclePredictionData';

/**
 * How hard a day of the cycle suits training, for the 9:00 note and the
 * warning before a workout starts.
 *
 * - `periodHeavy`: the first two days of a period, when energy and comfort
 *   are usually lowest — rest or gentle movement.
 * - `period`: the rest of the period — light sessions.
 * - `premenstrual`: the last days before a predicted period — ease off.
 * - `peak`: follicular to ovulation — the phase most suited to hard work.
 * - `steady`: the luteal phase, or a late period — moderate sessions.
 *
 * `tough` marks the days a hard workout earns a warning.
 */
export type TrainingGuidanceKind =
  'periodHeavy' | 'period' | 'premenstrual' | 'peak' | 'steady';

export interface TrainingGuidance {
  kind: TrainingGuidanceKind;
  tough: boolean;
  day: number;
  /** Days until the predicted period, for the premenstrual copy. */
  daysToPeriod: number | null;
}

/** How many days before a predicted period count as premenstrual. */
const PREMENSTRUAL_DAYS = 3;

export function trainingGuidanceFor(
  data: CyclePredictionData,
  date: string
): TrainingGuidance {
  const daysToPeriod =
    data.nextPeriodStart && date < data.nextPeriodStart
      ? daysBetween(date, data.nextPeriodStart)
      : null;
  const base = { day: data.day, daysToPeriod };

  if (data.phase === 'menstrual')
    return data.day <= 2
      ? { ...base, kind: 'periodHeavy', tough: true }
      : { ...base, kind: 'period', tough: false };
  if (data.daysLate > 0) return { ...base, kind: 'steady', tough: false };
  if (daysToPeriod !== null && daysToPeriod <= PREMENSTRUAL_DAYS)
    return { ...base, kind: 'premenstrual', tough: true };
  if (
    data.phase === 'follicular' ||
    data.phase === 'fertile' ||
    data.phase === 'ovulation'
  )
    return { ...base, kind: 'peak', tough: false };
  return { ...base, kind: 'steady', tough: false };
}

/**
 * The note's wording. Discreet mode keeps cycle words off the lock screen and
 * out of the dialog: the advice stays, the reason does not.
 */
export function trainingGuidanceCopy(
  t: TFunction,
  guidance: TrainingGuidance,
  discreet: boolean
): { title: string; body: string } {
  const { day, daysToPeriod } = guidance;
  if (discreet) {
    const title = t('cycleTraining.discreet.title', {
      defaultValue: "Today's training note",
    });
    switch (guidance.kind) {
      case 'periodHeavy':
        return {
          title,
          body: t('cycleTraining.discreet.rest', {
            defaultValue:
              'Today suits rest or gentle movement: a walk, stretching or yoga.',
          }),
        };
      case 'period':
      case 'premenstrual':
        return {
          title,
          body: t('cycleTraining.discreet.easy', {
            defaultValue:
              'Keep training light today and give recovery priority.',
          }),
        };
      case 'peak':
        return {
          title,
          body: t('cycleTraining.discreet.peak', {
            defaultValue:
              'A good day to push: heavy lifts or intervals. Warm up well.',
          }),
        };
      case 'steady':
        return {
          title,
          body: t('cycleTraining.discreet.steady', {
            defaultValue: 'Moderate training suits today.',
          }),
        };
    }
  }
  switch (guidance.kind) {
    case 'periodHeavy':
      return {
        title: t('cycleTraining.periodHeavy.title', {
          defaultValue: 'Take it easy today',
        }),
        body: t('cycleTraining.periodHeavy.body', {
          defaultValue:
            'Day {{day}} of your cycle. Energy usually runs lowest now, so a walk, stretching or yoga will do more for you than a hard session.',
          day,
        }),
      };
    case 'period':
      return {
        title: t('cycleTraining.period.title', {
          defaultValue: 'Light training today',
        }),
        body: t('cycleTraining.period.body', {
          defaultValue:
            'Day {{day}} of your cycle. Easy cardio and mobility work well while your period winds down.',
          day,
        }),
      };
    case 'premenstrual':
      return {
        title: t('cycleTraining.premenstrual.title', {
          defaultValue: 'Ease off before your period',
        }),
        body: t('cycleTraining.premenstrual.body', {
          defaultValue:
            'Your period is due in {{count}} days. Lower the intensity and give recovery priority.',
          count: daysToPeriod ?? 1,
        }),
      };
    case 'peak':
      return {
        title: t('cycleTraining.peak.title', {
          defaultValue: 'A good day to push',
        }),
        body: t('cycleTraining.peak.body', {
          defaultValue:
            'Day {{day}} of your cycle. Energy and strength tend to peak in this phase, so it suits heavy lifts or intervals. Warm up well.',
          day,
        }),
      };
    case 'steady':
      return {
        title: t('cycleTraining.steady.title', {
          defaultValue: 'Steady training today',
        }),
        body: t('cycleTraining.steady.body', {
          defaultValue:
            'Day {{day}} of your cycle. Moderate sessions suit this phase; keep an eye on fatigue and sleep.',
          day,
        }),
      };
  }
}
