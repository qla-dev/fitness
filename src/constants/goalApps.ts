import type { ImageSourcePropType } from 'react-native';
import type { ActivityGoalKey } from './activityGoals';
import type { HealthTrendKey } from './healthTrends';

/**
 * An app that works on a goal alongside this one, listed under the goal's
 * detail screen. Name and developer are the store listing's own words, so they
 * stay literal rather than going through `t()`.
 */
export interface GoalApp {
  id: string;
  name: string;
  developer: string;
  icon: ImageSourcePropType;
  appStoreUrl: string;
  playStoreUrl: string;
}

const SNOVI: GoalApp = {
  id: 'snovi',
  name: 'snovi.fm',
  developer: 'qla.dev',
  icon: require('../../assets/goal-apps/snovi.jpg'),
  appStoreUrl: 'https://apps.apple.com/app/snovi-fm/id6758638251',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=snovi.qla.dev',
};

/** Every goal is listed, so a new one is a compile error until it has a row. */
export const GOAL_APPS: Record<ActivityGoalKey | HealthTrendKey, GoalApp[]> = {
  move: [],
  exercise: [],
  stand: [],
  steps: [],
  distance: [],
  water: [],
  weight: [],
  sleep: [SNOVI],
};
