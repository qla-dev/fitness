import {
  addWatchMeasurementListener,
  completeWatchGoalRequest,
} from '../../modules/watch-link';
import { queryClient } from '../hooks/queryClient';
import { refreshHealthSyncCache } from '../hooks/refreshHealthSyncCache';
import { localApiFetch } from './local/localApi';
import { addLog } from './LogService';

export function subscribeWatchMeasurements() {
  return addWatchMeasurementListener((request) => {
    void (async () => {
      let success = false;
      try {
        await localApiFetch({
          endpoint: '/api/measurements/watch',
          method: 'POST',
          body: request,
        });
        success = true;
        void refreshHealthSyncCache(queryClient).catch((error) =>
          addLog('[Watch] Measurement refresh failed', 'WARNING', [
            String(error),
          ])
        );
      } catch (error) {
        addLog('[Watch] Measurement save failed', 'WARNING', [String(error)]);
      }
      await completeWatchGoalRequest(request.id, success);
    })().catch((error) =>
      addLog('[Watch] Measurement acknowledgement failed', 'WARNING', [
        String(error),
      ])
    );
  });
}
