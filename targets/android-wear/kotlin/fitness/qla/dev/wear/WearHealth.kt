package fitness.qla.dev.wear

import android.content.Context
import androidx.health.services.client.ExerciseClient
import androidx.health.services.client.ExerciseUpdateCallback
import androidx.health.services.client.HealthServices
import androidx.health.services.client.data.Availability
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.ExerciseConfig
import androidx.health.services.client.data.ExerciseLapSummary
import androidx.health.services.client.data.ExerciseType
import androidx.health.services.client.data.ExerciseUpdate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.guava.await

/** What the wrist is reading right now. */
data class WearLiveMetrics(
    val heartRate: Int? = null,
    val distanceMeters: Double = 0.0,
    val calories: Double = 0.0,
    val elapsedMillis: Long = 0L,
)

/** Where a watch-recorded session is in its life. */
enum class WearSessionPhase { Idle, Preparing, Running, Paused, Ended }

/**
 * Recording on the wrist, through Health Services.
 *
 * The counterpart to `WorkoutManager.swift`'s HealthKit session: the watch owns
 * the sensors, so heart rate and the running totals come from here rather than
 * from the phone. What the watch does NOT own is the diary — totals are sent
 * across as they change and the phone writes the row, which is why this emits
 * metrics rather than saving anything itself.
 *
 * Deliberately tolerant of a watch that cannot do this: Health Services is not
 * on every device, and a session that silently never starts is worse than one
 * that says it cannot. `isAvailable` is checked before anything is offered.
 */
object WearHealth {
    private val _phase = MutableStateFlow(WearSessionPhase.Idle)
    val phase: StateFlow<WearSessionPhase> = _phase

    private val _metrics = MutableStateFlow(WearLiveMetrics())
    val metrics: StateFlow<WearLiveMetrics> = _metrics

    /** Null until asked, so the UI can tell "no" from "not yet asked". */
    private val _supported = MutableStateFlow<Boolean?>(null)
    val supported: StateFlow<Boolean?> = _supported

    /**
     * What Health Services checks before it will open a session. Both are
     * runtime grants, and it fails silently without them, so they are asked
     * for rather than only declared.
     */
    val REQUIRED_PERMISSIONS = arrayOf(
        "android.permission.BODY_SENSORS",
        "android.permission.ACTIVITY_RECOGNITION",
        "android.permission.health.READ_HEART_RATE",
    )

    private var client: ExerciseClient? = null

    private fun client(context: Context): ExerciseClient =
        client ?: HealthServices.getClient(context).exerciseClient.also { client = it }

    /**
     * Whether this watch can record the sport at all.
     *
     * Asked once and remembered: the answer is a property of the hardware, and
     * every surface that offers a session reads the same flag.
     */
    suspend fun refreshSupport(context: Context, sport: WearSport) {
        _supported.value = runCatching {
            val capabilities = client(context).getCapabilitiesAsync().await()
            capabilities.supportedExerciseTypes.contains(sport.exerciseType)
        }.getOrDefault(false)
    }

    suspend fun start(context: Context, sport: WearSport): Boolean {
        if (_phase.value == WearSessionPhase.Running) return true
        _phase.value = WearSessionPhase.Preparing
        return runCatching {
            val exerciseClient = client(context)
            exerciseClient.setUpdateCallback(callback)
            val config = ExerciseConfig.builder(sport.exerciseType)
                .setDataTypes(TRACKED)
                // The watch is the clock for a watch-started session, so it
                // keeps running while the screen is off and while the phone is
                // out of range — which is the whole point of recording here.
                .setIsAutoPauseAndResumeEnabled(false)
                .setIsGpsEnabled(false)
                .build()
            exerciseClient.startExerciseAsync(config).await()
            _phase.value = WearSessionPhase.Running
            true
        }.getOrElse {
            _phase.value = WearSessionPhase.Idle
            false
        }
    }

    suspend fun pause(context: Context) {
        runCatching { client(context).pauseExerciseAsync().await() }
            .onSuccess { _phase.value = WearSessionPhase.Paused }
    }

    suspend fun resume(context: Context) {
        runCatching { client(context).resumeExerciseAsync().await() }
            .onSuccess { _phase.value = WearSessionPhase.Running }
    }

    suspend fun end(context: Context) {
        runCatching { client(context).endExerciseAsync().await() }
        _phase.value = WearSessionPhase.Ended
    }

    /** Back to a clean slate once the phone has been told what happened. */
    fun reset() {
        _phase.value = WearSessionPhase.Idle
        _metrics.value = WearLiveMetrics()
    }

    private val callback = object : ExerciseUpdateCallback {
        override fun onExerciseUpdateReceived(update: ExerciseUpdate) {
            val latest = update.latestMetrics
            val heartRate = latest.getData(DataType.HEART_RATE_BPM)
                .lastOrNull()?.value?.toInt()
            val distance = latest.getData(DataType.DISTANCE_TOTAL)?.total
            val calories = latest.getData(DataType.CALORIES_TOTAL)?.total
            _metrics.value = WearLiveMetrics(
                // Each field keeps its last reading when this update does not
                // carry one: heart rate arrives far less often than the update
                // itself, and blanking it between beats made the figure flicker.
                heartRate = heartRate ?: _metrics.value.heartRate,
                distanceMeters = distance ?: _metrics.value.distanceMeters,
                calories = calories ?: _metrics.value.calories,
                // Not the checkpoint's duration on its own: Health Services
                // refreshes that only now and then, so read raw it sat at
                // 00:00 while distance and calories climbed. The checkpoint is
                // a mark in time, and the live figure is that mark plus
                // whatever has passed since it was taken.
                elapsedMillis = update.activeDurationCheckpoint?.let { checkpoint ->
                    checkpoint.activeDuration.toMillis() +
                        (System.currentTimeMillis() - checkpoint.time.toEpochMilli())
                            .coerceAtLeast(0L)
                } ?: _metrics.value.elapsedMillis,
            )
        }

        override fun onLapSummaryReceived(lapSummary: ExerciseLapSummary) = Unit

        override fun onRegistered() = Unit

        override fun onRegistrationFailed(throwable: Throwable) {
            _supported.value = false
        }

        override fun onAvailabilityChanged(
            dataType: DataType<*, *>,
            availability: Availability,
        ) = Unit
    }

    /**
     * Heart rate is the reason to record here at all; distance and calories
     * come along because Health Services derives them from the same session.
     */
    private val TRACKED = setOf(
        DataType.HEART_RATE_BPM,
        DataType.DISTANCE_TOTAL,
        DataType.CALORIES_TOTAL,
    )
}

/** The Health Services type behind each sport the app offers. */
val WearSport.exerciseType: ExerciseType
    get() = when (this) {
        WearSport.Run -> ExerciseType.RUNNING
        WearSport.Ride -> ExerciseType.BIKING
    }
