package fitness.qla.dev.wear

import android.content.Context
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.tasks.await

/**
 * The watch half of the phone link.
 *
 * Mirrors what `modules/watch-link` does over WatchConnectivity on iOS: one
 * path per message kind, JSON bodies, and the phone as the source of truth for
 * anything that belongs to the diary. Kept deliberately close to the iOS
 * protocol — the same names appear in `targets/watch/WorkoutManager.swift` —
 * so the two watches speak one vocabulary and a change to the phone serves
 * both.
 *
 * Paths are duplicated by hand on the phone side, the way the WatchConnectivity
 * message keys already are, because neither half can import the other.
 */
object WearLink {
    const val PATH_PREFIX = "/qlafit"

    /** Watch -> phone. */
    const val PATH_PROBE_REPLY = "$PATH_PREFIX/probeReply"
    const val PATH_REQUEST_WORKOUT = "$PATH_PREFIX/requestWorkout"
    const val PATH_ADD_MEASUREMENT = "$PATH_PREFIX/addMeasurement"
    const val PATH_SET_NUTRIENT_GOAL = "$PATH_PREFIX/setNutrientGoal"
    const val PATH_HEART_RATE = "$PATH_PREFIX/heartRate"
    const val PATH_STATE = "$PATH_PREFIX/state"

    /** Phone -> watch. */
    const val PATH_PROBE = "$PATH_PREFIX/probe"
    const val PATH_START = "$PATH_PREFIX/start"
    const val PATH_STOP = "$PATH_PREFIX/stop"
    const val PATH_PROGRAMS = "$PATH_PREFIX/programs"
    const val PATH_DASHBOARD = "$PATH_PREFIX/dashboard"
    const val PATH_METRICS = "$PATH_PREFIX/metrics"
    const val PATH_GOAL_RESULT = "$PATH_PREFIX/goalResult"

    /**
     * Sends to every connected node rather than a remembered one: the phone is
     * the only peer a watch has in practice, and holding an id across a
     * reconnect is how these links go quiet without saying so.
     */
    suspend fun send(context: Context, path: String, body: ByteArray = ByteArray(0)): Boolean {
        val nodes = Wearable.getNodeClient(context).connectedNodes.await()
        if (nodes.isEmpty()) return false
        var delivered = false
        val client: MessageClient = Wearable.getMessageClient(context)
        for (node in nodes) {
            runCatching { client.sendMessage(node.id, path, body).await() }
                .onSuccess { delivered = true }
        }
        return delivered
    }

    /** Whether a phone is currently in range and paired. */
    suspend fun isPhoneReachable(context: Context): Boolean =
        runCatching { Wearable.getNodeClient(context).connectedNodes.await().isNotEmpty() }
            .getOrDefault(false)

    fun bodyText(event: MessageEvent): String = String(event.data, Charsets.UTF_8)
}
