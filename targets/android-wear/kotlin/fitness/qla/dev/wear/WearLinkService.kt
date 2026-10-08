package fitness.qla.dev.wear

import android.content.Intent
import android.util.Log
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject

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
        val body = WearLink.bodyText(event)
        when (event.path) {
            WearLink.PATH_PROBE -> scope.launch {
                WearLink.send(applicationContext, WearLink.PATH_PROBE_REPLY)
            }

            WearLink.PATH_GOAL_RESULT -> WearRequests.onGoalResult(body)

            // The phone opened a session: follow it, and bring the app up so
            // the countdown and the live figures are what the wrist shows.
            WearLink.PATH_START -> {
                val json = runCatching { JSONObject(body) }.getOrNull()
                scope.launch {
                    WearSession.startFromPhone(
                        applicationContext,
                        sportId = json?.optString("sportId")?.takeIf { it.isNotEmpty() },
                        recording = json?.optString("sport")?.takeIf { it.isNotEmpty() },
                        startAt = json?.optDouble("startAt")?.takeIf { !it.isNaN() }?.toLong(),
                        requestedAt = json?.optDouble("requestedAt")?.takeIf { !it.isNaN() }?.toLong(),
                    )
                }
                bringToFront()
            }

            WearLink.PATH_STOP -> scope.launch { WearSession.stopFromPhone(applicationContext) }

            // Everything else is state the screens read, and `onMessage` below
            // is what takes it. Logged as "carried" rather than "unhandled",
            // because the dashboard and programs arrive here and the old
            // wording said they were being dropped — which is a lie to read
            // mid-debugging, and cost real time once already.
            else -> Log.d(TAG, "Carried to state: ${event.path}")
        }
        WearState.onMessage(event.path, body)
        if (event.path == WearLink.PATH_METRICS) {
            scope.launch { WearSession.onPhoneMetrics(applicationContext) }
        }
    }

    /**
     * Best effort: Wear OS may refuse an activity start from the background,
     * in which case the session is still running and appears as soon as the
     * app is opened.
     */
    private fun bringToFront() {
        runCatching {
            startActivity(
                Intent(applicationContext, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            )
        }.onFailure { Log.d(TAG, "Could not bring the app forward: ${it.message}") }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
    }

    private companion object {
        const val TAG = "qla.fit/wear"
    }
}
