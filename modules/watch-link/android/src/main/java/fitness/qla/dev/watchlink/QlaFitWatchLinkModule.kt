package fitness.qla.dev.watchlink

import android.content.Context
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject

/**
 * The phone half of the watch link, on Android.
 *
 * Deliberately the same module name and the same API as the Apple half in
 * `ios/QlaFitWatchLinkModule.swift`: the JS in `modules/watch-link/index.ts`
 * and everything above it was written against that surface, so a Wear OS watch
 * arrives as the same "watch" the app already knows rather than a second
 * concept. Where WatchConnectivity has sessions and reachability, the Data
 * Layer has nodes and capabilities; the mapping is spelled out per property
 * below because the two do not line up exactly.
 *
 * Message paths are duplicated by hand from `targets/android-wear/…/WearLink.kt`,
 * the way the WatchConnectivity keys already are between phone and watch:
 * neither side can import the other.
 */
class QlaFitWatchLinkModule : Module() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Watch -> phone. */
    private val pathProbeReply = "$PATH_PREFIX/probeReply"
    private val pathRequestWorkout = "$PATH_PREFIX/requestWorkout"
    private val pathAddMeasurement = "$PATH_PREFIX/addMeasurement"
    private val pathSetNutrientGoal = "$PATH_PREFIX/setNutrientGoal"
    private val pathHeartRate = "$PATH_PREFIX/heartRate"
    private val pathState = "$PATH_PREFIX/state"

    /** Phone -> watch. */
    private val pathProbe = "$PATH_PREFIX/probe"
    private val pathStart = "$PATH_PREFIX/start"
    private val pathStop = "$PATH_PREFIX/stop"
    private val pathPrograms = "$PATH_PREFIX/programs"
    private val pathDashboard = "$PATH_PREFIX/dashboard"
    private val pathMetrics = "$PATH_PREFIX/metrics"

    private val context: Context
        get() = requireNotNull(appContext.reactContext) { "No React context" }

    /** Answers to an in-flight `probeWatch`, if one is waiting. */
    private var probeWaiter: ((Boolean) -> Unit)? = null

    private val listener = MessageClient.OnMessageReceivedListener { event ->
        onWatchMessage(event)
    }

    override fun definition() = ModuleDefinition {
        Name("QlaFitWatchLink")

        Events(
            "onHeartRate",
            "onWorkoutState",
            "onReachabilityChange",
            "onGoalRequest",
            "onMeasurementRequest",
        )

        OnStartObserving {
            Wearable.getMessageClient(context).addListener(listener)
        }

        OnStopObserving {
            Wearable.getMessageClient(context).removeListener(listener)
        }

        OnDestroy {
            runCatching {
                Wearable.getMessageClient(context).removeListener(listener)
            }
        }

        // Play Services carries the Data Layer; without it there is no link at
        // all, which is the same thing `WCSession.isSupported()` reports.
        Property("isSupported") {
            GoogleApiAvailability.getInstance()
                .isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
        }

        // The Data Layer has no separate "paired but out of range": a node is
        // listed when it is connected, so paired and reachable answer the same
        // question here. Kept as two properties so the JS above does not have
        // to know which platform it is on.
        Property("isPaired") { connectedNodeCount() > 0 }

        Property("isReachable") { connectedNodeCount() > 0 }

        Property("isWatchAppInstalled") { capableNodeCount() > 0 }

        Property("watchName") { firstNodeName() }

        AsyncFunction("probeWatch") { ->
            probeWatchBlocking()
        }

        AsyncFunction("startWorkout") { sport: String, sportId: String?, startAt: Double? ->
            val body = JSONObject()
                .put("sport", sport)
                // When this was asked for, so a watch that receives it late can
                // tell a stale command from a live one, as `requestedAt` does on iOS.
                .put("requestedAt", System.currentTimeMillis())
                .apply {
                    sportId?.let { put("sportId", it) }
                    startAt?.let { put("startAt", it) }
                }
            sendBlocking(pathStart, body.toString())
        }

        AsyncFunction("stopWorkout") { ->
            sendBlocking(pathStop, "")
        }

        AsyncFunction("updateDashboard") { value: Map<String, Any?> ->
            sendBlocking(pathDashboard, JSONObject(value).toString())
        }

        AsyncFunction("updatePrograms") { value: Map<String, Any?> ->
            sendBlocking(pathPrograms, JSONObject(value).toString())
        }

        // The recorder publishes on every GPS fix, far faster than a blocking
        // Data Layer send returns. Sent inline, the calls queued up behind one
        // another — and so did `stopWorkout` behind them: a discard reached
        // the watch minutes late and it kept showing a session that had ended.
        // Only the newest figures matter, so they are handed to one background
        // sender that always takes the latest and drops what it skipped.
        AsyncFunction("updateMetrics") { value: Map<String, Any?> ->
            queueMetrics(JSONObject(value).toString())
        }

        // The watch writes through the phone, so it waits for this before it
        // shows the value as saved.
        AsyncFunction("completeGoalRequest") { id: String, success: Boolean ->
            val body = JSONObject().put("id", id).put("success", success)
            sendBlocking("$PATH_PREFIX/goalResult", body.toString())
        }
    }

    private fun onWatchMessage(event: MessageEvent) {
        val body = String(event.data, Charsets.UTF_8)
        when (event.path) {
            pathProbeReply -> {
                probeWaiter?.invoke(true)
                probeWaiter = null
            }

            pathHeartRate -> emit("onHeartRate", body)
            pathState -> emit("onWorkoutState", body)
            pathRequestWorkout -> emit("onWorkoutState", body)
            pathAddMeasurement -> emit("onMeasurementRequest", body)
            pathSetNutrientGoal -> emit("onGoalRequest", body)
        }
    }

    /**
     * Events carry the watch's JSON verbatim rather than a re-encoded map: the
     * JS already parses the same shapes coming off WatchConnectivity, and
     * rebuilding them here is a second place for the two to drift.
     */
    private fun emit(name: String, body: String) {
        val payload = runCatching { JSONObject(body) }.getOrNull()
        val map = mutableMapOf<String, Any?>()
        payload?.keys()?.forEach { key -> map[key] = payload.get(key) }
        sendEvent(name, map)
    }

    private suspend fun connectedNodes() =
        runCatching { Wearable.getNodeClient(context).connectedNodes.await() }
            .getOrDefault(emptyList())

    private fun connectedNodeCount(): Int = runBlockingIO { connectedNodes().size }

    private fun firstNodeName(): String? =
        runBlockingIO { connectedNodes().firstOrNull()?.displayName }

    private fun capableNodeCount(): Int = runBlockingIO {
        runCatching {
            Wearable.getCapabilityClient(context)
                .getCapability(CAPABILITY, CapabilityClient.FILTER_REACHABLE)
                .await()
                .nodes
                .size
        }.getOrDefault(0)
    }

    private fun sendBlocking(path: String, body: String): Boolean = runBlockingIO { send(path, body) }

    private suspend fun send(path: String, body: String): Boolean {
        val nodes = connectedNodes()
        if (nodes.isEmpty()) return false
        val client = Wearable.getMessageClient(context)
        var delivered = false
        for (node in nodes) {
            runCatching {
                client.sendMessage(node.id, path, body.toByteArray(Charsets.UTF_8)).await()
            }.onSuccess { delivered = true }
        }
        return delivered
    }

    /** The newest metrics not yet sent; older ones are overwritten, not queued. */
    private var pendingMetrics: String? = null
    private var metricsSender: Job? = null

    private fun queueMetrics(body: String) {
        synchronized(this) {
            pendingMetrics = body
            if (metricsSender?.isActive == true) return
            metricsSender = scope.launch {
                while (true) {
                    val next = synchronized(this@QlaFitWatchLinkModule) {
                        pendingMetrics.also { pendingMetrics = null }
                    } ?: break
                    send(pathMetrics, next)
                }
            }
        }
    }

    /**
     * Wakes the watch app and waits for it to answer, so a session is only
     * handed over to a watch that is actually listening. The timeout is what
     * turns "asleep" into an answer rather than a hang.
     */
    private fun probeWatchBlocking(): Boolean = runBlockingIO {
        val sent = sendBlocking(pathProbe, "")
        if (!sent) return@runBlockingIO false
        kotlinx.coroutines.withTimeoutOrNull(PROBE_TIMEOUT_MS) {
            kotlinx.coroutines.suspendCancellableCoroutine { continuation ->
                probeWaiter = { answered ->
                    if (continuation.isActive) continuation.resumeWith(Result.success(answered))
                }
                continuation.invokeOnCancellation { probeWaiter = null }
            }
        } ?: false
    }

    private fun <T> runBlockingIO(block: suspend () -> T): T =
        kotlinx.coroutines.runBlocking(Dispatchers.IO) { block() }

    private companion object {
        const val PATH_PREFIX = "/qlafit"
        const val CAPABILITY = "qlafit_wear_app"
        const val PROBE_TIMEOUT_MS = 4_000L
    }
}
