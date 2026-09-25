import {
  addWatchMeasurementListener,
  completeWatchGoalRequest,
} from '../../modules/watch-link';
import { queryClient } from '../hooks/queryClient';
import { refreshHealthSyncCache } from '../hooks/refreshHealthSyncCache';
import { isLocalDataMode } from './dataMode';
import { localApiFetch } from './local/localApi';
import { addLog } from './LogService';

export function subscribeWatchMeasurements() {
  return addWatchMeasurementListener((request) => {
    void (async () => {
      let success = false;
      try {
        if (!isLocalDataMode())
          throw new Error('Watch measurements require local mode');
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
