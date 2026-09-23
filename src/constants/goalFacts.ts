import type { TFunction } from 'i18next';
import type { ActivityGoalKey } from './activityGoals';
import type { HealthTrendKey } from './healthTrends';

export function goalFactCopy(
  t: TFunction,
  metric: ActivityGoalKey | HealthTrendKey
) {
  switch (metric) {
    case 'steps':
      return {
        coverTitle: t('goalFacts.steps.coverTitle', {
          defaultValue: 'Every walk has a story',
        }),
        coverBody: t('goalFacts.steps.coverBody', {
          defaultValue:
            'The familiar route, the longer way home, the little detour: see how everyday steps become your own rhythm.',
        }),
        aboutTitle: t('goalFacts.steps.aboutTitle', {
          defaultValue: 'About steps',
        }),
        aboutBody: t('goalFacts.steps.aboutBody', {
          defaultValue:
            'Steps count the walking and running your device records throughout the day. Your recent trend compares the last 15 days with the 13 days before them. Month and year cards average recorded days only; a missing day is not treated as zero.',
        }),
        trendTitle: t('goalFacts.steps.trendTitle', {
          defaultValue: 'Your walking rhythm',
        }),
        detailTitle: t('goalFacts.steps.detailTitle', {
          defaultValue: 'Daily pace',
        }),
      };
    case 'move':
      return {
        coverTitle: t('goalFacts.move.coverTitle', {
          defaultValue: 'Find your everyday energy',
        }),
        coverBody: t('goalFacts.move.coverBody', {
          defaultValue:
            'A walk to the shop, a dance in the kitchen, a workout you love. Movement can fit into the day you already have.',
        }),
        aboutTitle: t('goalFacts.move.aboutTitle', {
          defaultValue: 'Reading your Move goal',
        }),
        aboutBody: t('goalFacts.move.aboutBody', {
          defaultValue:
            'Move tracks active energy, measured in kilocalories. It is different from total energy, which also includes the energy your body uses at rest. Device estimates help you compare your own days; they are not an exact measure of effort.',
        }),
        trendTitle: t('goalFacts.move.trendTitle', {
          defaultValue: 'Your energy over two fortnights',
        }),
        detailTitle: t('goalFacts.move.detailTitle', {
          defaultValue: 'Your weekly energy budget',
        }),
      };
    case 'exercise':
      return {
        coverTitle: t('goalFacts.exercise.coverTitle', {
          defaultValue: 'Make room for your kind of movement',
        }),
        coverBody: t('goalFacts.exercise.coverBody', {
          defaultValue:
            'A favourite route or a familiar training session can become something to look forward to. Find the pattern that fits your week.',
        }),
        aboutTitle: t('goalFacts.exercise.aboutTitle', {
          defaultValue: 'Minutes with meaning',
        }),
        aboutBody: t('goalFacts.exercise.aboutBody', {
          defaultValue:
            'Exercise minutes come from recorded workouts and your health provider. A provider may count only minutes that meet its activity criteria, so exercise time can differ from the time you spent in a session.',
        }),
        trendTitle: t('goalFacts.exercise.trendTitle', {
          defaultValue: 'How your training time is changing',
        }),
        detailTitle: t('goalFacts.exercise.detailTitle', {
          defaultValue: 'How often you showed up',
        }),
      };
    case 'stand':
      return {
        coverTitle: t('goalFacts.stand.coverTitle', {
          defaultValue: 'Give your day a change of scenery',
        }),
        coverBody: t('goalFacts.stand.coverBody', {
          defaultValue:
            'Open the window, refill a glass, take a short break from the desk. Small transitions can give a long day a different shape.',
        }),
        aboutTitle: t('goalFacts.stand.aboutTitle', {
          defaultValue: 'An hour is a window',
        }),
        aboutBody: t('goalFacts.stand.aboutBody', {
          defaultValue:
            'Stand hours count hours that contain qualifying standing activity. They do not mean you stood for the full hour. Use the daily pattern to spot long stretches without a recorded standing break.',
        }),
        trendTitle: t('goalFacts.stand.trendTitle', {
          defaultValue: 'Your standing rhythm',
        }),
        detailTitle: t('goalFacts.stand.detailTitle', {
          defaultValue: 'Weekdays and weekends',
        }),
      };
    case 'distance':
      return {
        coverTitle: t('goalFacts.distance.coverTitle', {
          defaultValue: 'See how far the little journeys go',
        }),
        coverBody: t('goalFacts.distance.coverBody', {
          defaultValue:
            'The corner shop, a park loop, a new path: your recorded distance turns separate outings into a bigger picture.',
        }),
        aboutTitle: t('goalFacts.distance.aboutTitle', {
          defaultValue: 'Distance tells another story',
        }),
        aboutBody: t('goalFacts.distance.aboutBody', {
          defaultValue:
            'Distance describes how far you travelled, while steps describe how many steps were recorded. Your device may estimate distance from movement or GPS. Different routes and recording methods can give different results.',
        }),
        trendTitle: t('goalFacts.distance.trendTitle', {
          defaultValue: 'Your daily distance is taking shape',
        }),
        detailTitle: t('goalFacts.distance.detailTitle', {
          defaultValue: 'The journeys add up',
        }),
      };
    case 'water':
      return {
        coverTitle: t('goalFacts.water.coverTitle', {
          defaultValue: 'A place for every refill',
        }),
        coverBody: t('goalFacts.water.coverBody', {
          defaultValue:
            'A glass by breakfast, a bottle in your bag, a refill at your desk. Make logging a drink part of the moment you enjoy it.',
        }),
        aboutTitle: t('goalFacts.water.aboutTitle', {
          defaultValue: 'What your water chart includes',
        }),
        aboutBody: t('goalFacts.water.aboutBody', {
          defaultValue:
            'This chart shows the water logged in your diary and imported from your health provider. It is a record of what was entered, so an empty day does not necessarily mean you drank nothing. Your goal is a personal setting, not a measurement of your hydration.',
        }),
        trendTitle: t('goalFacts.water.trendTitle', {
          defaultValue: 'Your refill rhythm',
        }),
        detailTitle: t('goalFacts.water.detailTitle', {
          defaultValue: 'A week of refills at a time',
        }),
      };
    case 'weight':
      return {
        coverTitle: t('goalFacts.weight.coverTitle', {
          defaultValue: 'Look for the longer story',
        }),
        coverBody: t('goalFacts.weight.coverBody', {
          defaultValue:
            'Give each weigh-in some context. A sequence of readings is a more useful picture than a single point on the scale.',
        }),
        aboutTitle: t('goalFacts.weight.aboutTitle', {
          defaultValue: 'Make readings comparable',
        }),
        aboutBody: t('goalFacts.weight.aboutBody', {
          defaultValue:
            'The scale captures one moment. Comparing readings taken on the same scale and at a similar time makes the pattern easier to follow. These cards use recorded weigh-ins only, and never fill a missing day with zero.',
        }),
        trendTitle: t('goalFacts.weight.trendTitle', {
          defaultValue: 'A calmer view of your weight trend',
        }),
        detailTitle: t('goalFacts.weight.detailTitle', {
          defaultValue: 'The range of your recorded weigh-ins',
        }),
      };
    case 'sleep':
      return {
        coverTitle: t('goalFacts.sleep.coverTitle', {
          defaultValue: 'Make space for the night',
        }),
        coverBody: t('goalFacts.sleep.coverBody', {
          defaultValue:
            'Let the day fade into a quieter rhythm. Your sleep history is a place to notice the nights that fit the routine you want.',
        }),
        aboutTitle: t('goalFacts.sleep.aboutTitle', {
          defaultValue: 'Time in bed and time asleep',
        }),
        aboutBody: t('goalFacts.sleep.aboutBody', {
          defaultValue:
            'Time in bed is the interval between going to bed and getting up. Time asleep is the part your device estimates you spent sleeping. They are different readings. These facts compare time asleep and leave out nights without that measurement.',
        }),
        trendTitle: t('goalFacts.sleep.trendTitle', {
          defaultValue: 'How your nights are changing',
        }),
        detailTitle: t('goalFacts.sleep.detailTitle', {
          defaultValue: 'Your shortest and longest nights',
        }),
      };
  }
}
