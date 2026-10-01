package fitness.qla.dev.wear

import android.util.Log
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Receives phone messages while the watch app is not in the foreground.
 *
 * The probe is the one that has to work from here: the phone asks whether the
 * watch app is awake before handing it a session, and a reply that only came
 * when the app happened to be open would make every cold watch read as absent.
 */
class WearLinkService : WearableListenerService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onMessageReceived(event: MessageEvent) {
        when (event.path) {
            WearLink.PATH_PROBE -> scope.launch {
                WearLink.send(applicationContext, WearLink.PATH_PROBE_REPLY)
            }

            WearLink.PATH_GOAL_RESULT -> WearRequests.onGoalResult(WearLink.bodyText(event))

            else -> Log.d(TAG, "Unhandled path ${event.path}")
        }
        WearState.onMessage(event.path, WearLink.bodyText(event))
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
    }

    private companion object {
        const val TAG = "qla.fit/wear"
    }
}
