package fitness.qla.dev.wear

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import java.util.UUID

/** How a write the phone owns is going. */
enum class WearWriteState { Idle, Saving, Saved, Failed }

/**
 * Writes that belong to the phone.
 *
 * The watch never touches the diary itself: a weight, a glass of water or a
 * nutrient goal is sent across and the phone writes it, exactly as the Apple
 * Watch does. So every one of these has three possible ends — saved, refused,
 * or no phone to ask — and the screens show which, rather than pretending the
 * value landed.
 */
object WearRequests {
    private val _state = MutableStateFlow(WearWriteState.Idle)
    val state: StateFlow<WearWriteState> = _state

    /** Requests waiting for the phone to confirm, by the id we sent. */
    private val pending = mutableMapOf<String, (Boolean) -> Unit>()

    fun clear() {
        _state.value = WearWriteState.Idle
    }

    /**
     * Sends a measurement and waits for the phone to say it was written.
     *
     * Timed out rather than left hanging: the watch is on a wrist, and a
     * spinner that never resolves because the phone went out of range is the
     * worst of the three outcomes to show.
     */
    suspend fun saveMeasurement(
        context: Context,
        kind: String,
        value: Double,
        unit: String,
    ): Boolean = submit(context, WearLink.PATH_ADD_MEASUREMENT) { id ->
        JSONObject()
            .put("id", id)
            .put("kind", kind)
            .put("value", value)
            .put("unit", unit)
    }

    suspend fun saveNutrientGoal(
        context: Context,
        key: String,
        value: Double,
    ): Boolean = submit(context, WearLink.PATH_SET_NUTRIENT_GOAL) { id ->
        JSONObject()
            .put("id", id)
            .put("key", key)
            .put("value", value)
    }

    /** The phone's answer to whichever request carried this id. */
    fun onGoalResult(body: String) {
        val json = runCatching { JSONObject(body) }.getOrNull() ?: return
        val id = json.optString("id").takeIf { it.isNotEmpty() } ?: return
        val success = json.optBoolean("success", false)
        pending.remove(id)?.invoke(success)
    }

    private suspend fun submit(
        context: Context,
        path: String,
        body: (String) -> JSONObject,
    ): Boolean {
        _state.value = WearWriteState.Saving
        val id = UUID.randomUUID().toString()
        val sent = WearLink.send(context, path, body(id).toString().toByteArray())
        if (!sent) {
            _state.value = WearWriteState.Failed
            return false
        }
        val answered = withTimeoutOrNull(REPLY_TIMEOUT_MS) {
            kotlinx.coroutines.suspendCancellableCoroutine { continuation ->
                pending[id] = { success ->
                    if (continuation.isActive) {
                        continuation.resumeWith(Result.success(success))
                    }
                }
                continuation.invokeOnCancellation { pending.remove(id) }
            }
        } ?: false
        _state.value = if (answered) WearWriteState.Saved else WearWriteState.Failed
        return answered
    }

    private const val REPLY_TIMEOUT_MS = 6_000L
}
