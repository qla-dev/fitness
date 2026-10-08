package fitness.qla.dev.wear

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Who opened the session, which decides who may end it and who saves it. */
enum class SessionOrigin { Watch, Phone }

/** The session the watch is showing, whichever side started it. */
data class WearActiveSession(
    val sport: WearSport,
    val origin: SessionOrigin,
    /** Set when the session is a program being walked set by set. */
    val program: WearProgram?,
    /** When the 3-2-1 ends, in epoch ms; the live view replaces it after. */
    val countdownUntil: Long,
    val startedAt: Long,
)

/**
 * The one place a session starts, runs and ends — the Android counterpart to
 * `WorkoutManager.swift`'s `start`, `startFromWatch`, `startProgram` and its
 * phone `start` / `stop` / `metrics` handling.
 *
 * Two origins, as on the Apple Watch:
 * - **Watch**: the wrist records and owns the clock; finishing sends the
 *   totals so the phone writes the diary row.
 * - **Phone**: the phone's recorder owns the session and the row. The watch
 *   mirrors the phone's live figures and adds what only the wrist has — heart
 *   rate — and ends when the phone says so. It never saves anything itself,
 *   which is what keeps one effort from becoming two rows.
 */
object WearSession {
    /** The same three seconds `WatchCountdown.seconds` gives the Apple Watch. */
    const val COUNTDOWN_MS = 3_000L

    private val _active = MutableStateFlow<WearActiveSession?>(null)
    val active: StateFlow<WearActiveSession?> = _active

    private val _finishing = MutableStateFlow(false)
    val finishing: StateFlow<Boolean> = _finishing

    private val _programStep = MutableStateFlow(0)
    val programStep: StateFlow<Int> = _programStep

    private val _restUntil = MutableStateFlow<Long?>(null)
    val restUntil: StateFlow<Long?> = _restUntil

    private var lastSetCompletion = 0L

    /** Start and stop can arrive from the phone and the wrist at once. */
    private val lock = Mutex()

    /** A sport picked on the watch; with [program], a program walked set by set. */
    suspend fun startFromWatch(
        context: Context,
        sport: WearSport,
        program: WearProgram? = null,
    ): Boolean = lock.withLock {
        if (_active.value != null || _finishing.value) return@withLock false
        WearState.setError(null)
        if (!WearHealth.start(context, sport)) {
            WearState.setError(START_FAILED)
            return@withLock false
        }
        val now = System.currentTimeMillis()
        resetProgram()
        _active.value = WearActiveSession(sport, SessionOrigin.Watch, program, now + COUNTDOWN_MS, now)
        // The phone is told so it can follow along; the wrist stays the
        // recorder, so an unreachable phone changes nothing here.
        if (WearLink.isPhoneReachable(context)) WearWorkout.requestFromPhone(context, sport)
        true
    }

    /**
     * The phone opened a session and wants the wrist to follow it.
     *
     * Ignored while a session is already running, as the Apple Watch does: a
     * watch-started session that the phone then picks up comes back here as a
     * start, and must not replace the session it came from.
     */
    suspend fun startFromPhone(
        context: Context,
        sportId: String?,
        recording: String?,
        startAt: Long?,
        requestedAt: Long? = null,
    ) = lock.withLock {
        if (_active.value != null || _finishing.value) return@withLock
        // A start that arrives long after it was sent is history, not a
        // request: the Data Layer delivers late rather than never, and acting
        // on it would open a session the phone has already ended.
        val sentAt = requestedAt ?: startAt
        if (sentAt != null && System.currentTimeMillis() - sentAt > STALE_START_MS) return@withLock
        WearState.setError(null)
        WearState.clearPhoneMetrics()
        val sport = WearSportCatalogue.byId(sportId) ?: WearSportCatalogue.fallback(recording)
        val now = System.currentTimeMillis()
        resetProgram()
        // A NEW session gets its full 3-2-1 even when waking the watch took
        // longer than the phone's own countdown, the same call iOS makes.
        _active.value = WearActiveSession(sport, SessionOrigin.Phone, null, now + COUNTDOWN_MS, startAt ?: now)
        // Heart rate is the one thing the phone cannot measure. Without the
        // sensor the session still mirrors the phone; it just says so.
        if (WearHealth.start(context, sport)) {
            WearWorkout.sendState(context, sport, running = true)
        } else {
            WearState.setError(HEART_RATE_UNAVAILABLE)
        }
    }

    /** The phone stopped, or finished, the session it opened. */
    suspend fun stopFromPhone(context: Context) = lock.withLock {
        val session = _active.value ?: return@withLock
        if (session.origin != SessionOrigin.Phone) return@withLock
        WearHealth.end(context)
        WearWorkout.sendState(context, session.sport, running = false)
        WearHealth.reset()
        WearState.clearPhoneMetrics()
        resetProgram()
        _active.value = null
    }

    /**
     * Follows the phone's recorder: its pause becomes the wrist's pause, and
     * its finish ends the wrist's half too.
     */
    suspend fun onPhoneMetrics(context: Context) {
        val session = _active.value ?: return
        if (session.origin != SessionOrigin.Phone) return
        val metrics = WearState.phoneMetrics.value ?: return
        when (metrics.phase) {
            "finished" -> stopFromPhone(context)
            "paused" -> if (WearHealth.phase.value == WearSessionPhase.Running) WearHealth.pause(context)
            else -> if (WearHealth.phase.value == WearSessionPhase.Paused) WearHealth.resume(context)
        }
    }

    /** Ends a watch-started session and hands its totals to the phone. */
    suspend fun finishFromWatch(context: Context) {
        val session = lock.withLock {
            val current = _active.value ?: return
            if (current.origin != SessionOrigin.Watch) return
            _finishing.value = true
            current
        }
        try {
            WearHealth.end(context)
            if (!WearWorkout.finish(context, session.sport, WearHealth.metrics.value)) {
                WearState.setError(FINISH_UNSENT)
            }
        } finally {
            WearHealth.reset()
            resetProgram()
            _active.value = null
            _finishing.value = false
        }
    }

    suspend fun pause(context: Context) {
        if (_active.value?.origin == SessionOrigin.Watch) WearHealth.pause(context)
    }

    suspend fun resume(context: Context) {
        if (_active.value?.origin == SessionOrigin.Watch) WearHealth.resume(context)
    }

    /**
     * Ticks off the current set and starts its rest, as `completeProgramSet`
     * does. A second tap within half a second is the same tap.
     */
    fun completeSet(): Boolean {
        val program = _active.value?.program ?: return false
        val steps = program.steps
        val step = _programStep.value
        val now = System.currentTimeMillis()
        if (step >= steps.size || WearHealth.phase.value == WearSessionPhase.Paused) return false
        if (now - lastSetCompletion < 500) return false
        lastSetCompletion = now
        val rest = steps[step].target.rest ?: 0.0
        _programStep.value = step + 1
        _restUntil.value = if (rest > 0) now + (rest * 1000).toLong() else null
        return true
    }

    private fun resetProgram() {
        _programStep.value = 0
        _restUntil.value = null
        lastSetCompletion = 0L
    }

    private const val STALE_START_MS = 60_000L

    private const val START_FAILED =
        "Could not start the workout. Allow sensor access in the watch settings and try again."
    private const val HEART_RATE_UNAVAILABLE =
        "Heart rate is unavailable. Your phone keeps recording."
    private const val FINISH_UNSENT =
        "Could not reach your phone. Open qla.fit on it to save this workout."
}
