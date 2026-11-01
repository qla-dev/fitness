import type { TFunction } from 'i18next';

/** Tracker features that open onto a screen carrying editorial facts. */
export type FeatureFactKey = 'cycle' | 'medications';

export interface FeatureFactCopy {
  covers: [{ title: string; body: string }, { title: string; body: string }];
  aboutTitle: string;
  aboutBody: string;
}

/** The same shape the goal facts use: two image covers, then an About card. */
export function featureFactCopy(
  t: TFunction,
  feature: FeatureFactKey
): FeatureFactCopy {
  switch (feature) {
    case 'cycle':
      return {
        covers: [
          {
            title: t('featureFacts.cycle.cover1Title', {
              defaultValue: 'More than your period',
            }),
            body: t('featureFacts.cycle.cover1Body', {
              defaultValue:
                'A cycle moves through four phases: menstrual, follicular, ovulation and luteal. Energy, sleep, appetite and mood can shift with each one, so knowing where you are helps the rest of your day make sense.',
            }),
          },
          {
            title: t('featureFacts.cycle.cover2Title', {
              defaultValue: 'Sharper with every cycle',
            }),
            body: t('featureFacts.cycle.cover2Body', {
              defaultValue:
                'Predictions come from the cycles you log. Mark when each period starts and ends, and the estimates for your next period and fertile window settle closer to your own rhythm.',
            }),
          },
        ],
        aboutTitle: t('featureFacts.cycle.aboutTitle', {
          defaultValue: 'About cycle tracking',
        }),
        aboutBody: t('featureFacts.cycle.aboutBody', {
          defaultValue:
            'Cycles between 21 and 35 days are common in adults, and stress, travel, illness or a change in routine can move one by days. Predictions are estimates, not contraception. Talk to a clinician if periods stop for three months or more, or bleeding or pain is much heavier than usual.',
        }),
      };
    case 'medications':
      return {
        covers: [
          {
            title: t('featureFacts.medications.cover1Title', {
              defaultValue: 'Routine is the best reminder',
            }),
            body: t('featureFacts.medications.cover1Body', {
              defaultValue:
                'Doses tied to something you already do, like breakfast or brushing your teeth, are the ones that get taken. Log each dose as you take it and the day shows what is done and what is still due.',
            }),
          },
          {
            title: t('featureFacts.medications.cover2Title', {
              defaultValue: 'As-needed doses count too',
            }),
            body: t('featureFacts.medications.cover2Body', {
              defaultValue:
                'Logging pain relief and other as-needed medicines shows how often you reach for them. A few weeks of that record is useful to bring to your next appointment.',
            }),
          },
        ],
        aboutTitle: t('featureFacts.medications.aboutTitle', {
          defaultValue: 'About medication tracking',
        }),
        aboutBody: t('featureFacts.medications.aboutBody', {
          defaultValue:
            'Medications records the doses you log and reminds you of the schedules you set. It does not check doses or interactions. Follow your prescriber or pharmacist, and ask them before doubling up after a missed dose.',
        }),
      };
  }
}
