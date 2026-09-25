import {
  addWatchGoalListener,
  completeWatchGoalRequest,
  type WatchGoalRequest,
} from '../../modules/watch-link';
import { MACRO_RINGS } from '../constants/macroRings';
import { goalMaximum, goalMinimum } from '../constants/profileGoals';
import { queryClient } from '../hooks/queryClient';
import { localApiFetch } from './local/localApi';
import { addLog } from './LogService';

export async function saveWatchGoal({
  key,
  value,
}: WatchGoalRequest): Promise<void> {
  const maximum = goalMaximum(key);
  if (
    !MACRO_RINGS.some((spec) => spec.key === key) ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value < goalMinimum(key) ||
    (maximum !== undefined && value > maximum)
  ) {
    throw new Error('Invalid watch nutrient goal');
  }
  await localApiFetch({
    endpoint: '/api/goals',
    method: 'PUT',
    body: { [key]: value },
  });
  void queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      ['goals', 'dailySummary', 'daily-summary'].includes(String(queryKey[0])),
  });
}

export function subscribeWatchGoals() {
  return addWatchGoalListener((request) => {
    void (async () => {
      let success = false;
      try {
        await saveWatchGoal(request);
        success = true;
      } catch (error) {
        addLog('[Watch] Goal save failed', 'WARNING', [String(error)]);
      }
      await completeWatchGoalRequest(request.id, success);
    })().catch((error) =>
      addLog('[Watch] Goal acknowledgement failed', 'WARNING', [String(error)])
    );
  });
}
