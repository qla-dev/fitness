package fitness.qla.dev.wear

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

/** One ring or figure on the dashboard: what is done out of what was asked. */
data class WearMetric(
    val label: String,
    val value: Double,
    val goal: Double?,
    val unit: String,
) {
    /** Null when there is no goal, so the UI can show a figure without a ring. */
    val fraction: Float?
        get() = goal?.takeIf { it > 0 }?.let { (value / it).coerceIn(0.0, 1.0).toFloat() }
}

/** A macro with the day's total and the goal it counts toward. */
data class WearNutrient(
    val key: String,
    val label: String,
    val consumed: Double,
    val goal: Double,
    val unit: String,
    val goalStep: Double,
    val goalMaximum: Double?,
    /** The phone's ring colour for this macro, as ARGB. */
    val color: Long,
)

/** One set as the program prescribes it; any field may be absent. */
data class WearSetTarget(
    val reps: Double?,
    val weight: Double?,
    val duration: Double?,
    val distance: Double?,
    val rest: Double?,
    val notes: String?,
) {
    /** "8 reps · 60 kg · 1:30", the same line `WatchProgram.SetTarget` builds. */
    val prescription: String
        get() = listOfNotNull(
            reps?.let { "${format(it)} reps" },
            weight?.takeIf { it > 0 }?.let { "${format(it)} kg" },
            duration?.takeIf { it > 0 }?.let { clock(it) },
            distance?.takeIf { it > 0 }?.let { "${format(it)} km" },
        ).joinToString(" · ")
}

/** One movement inside a program, with every set it asks for. */
data class WearExercise(val name: String, val sets: List<WearSetTarget>)

/** One step of a program in the order it is done: a set of a movement. */
data class WearProgramStep(val name: String, val number: Int, val target: WearSetTarget)

/** A saved workout program, as the phone stores it. */
data class WearProgram(
    val id: String,
    val name: String,
    val expiresAt: String?,
    val exercises: List<WearExercise>,
) {
    /** Every set of every movement, flattened in order — what "Start" walks. */
    val steps: List<WearProgramStep>
        get() = exercises.flatMap { exercise ->
            exercise.sets.mapIndexed { index, target ->
                WearProgramStep(exercise.name, index + 1, target)
            }
        }

    /** An unreadable date counts as expired, as it does on the Apple Watch. */
    val expired: Boolean
        get() = expiresAt?.let { raw ->
            runCatching { !Instant.parse(raw).isAfter(Instant.now()) }.getOrDefault(true)
        } ?: false
}

/** The phone's live recorder, while it is recording a session the watch shows. */
data class WearPhoneMetrics(
    val sessionId: String?,
    val startedAt: Long,
    val timestamp: Long,
    val phase: String,
    /** Seconds. */
    val elapsed: Double,
    /** Metres. */
    val distance: Double,
    /** Metres per second. */
    val speed: Double,
    val maxSpeed: Double,
    /** Metres. */
    val elevationGain: Double,
    val calories: Double,
)

/**
 * What the phone last told this watch.
 *
 * A process-wide holder rather than per-screen state, because messages arrive
 * at `WearLinkService` whether or not the UI is on screen — the same reason the
 * iOS side keeps this on its `WorkoutManager` rather than in a view.
 *
 * The payloads are the ones the phone ALREADY sends its Apple Watch
 * (`WatchDashboardSnapshot`, `WatchProgramsSnapshot` in
 * `modules/watch-link/index.ts`), parsed here rather than reshaped there. One
 * snapshot serves both watches, so a field added for one cannot quietly go
 * missing on the other.
 *
 * A stale snapshot is shown rather than nothing, labelled as stale: a watch
 * that goes blank because the phone is in a pocket is worse than one that says
 * "as of this morning" — the same call `WatchDashboardView` makes.
 */
object WearState {
    private val _dashboard = MutableStateFlow<List<WearMetric>>(emptyList())
    val dashboard: StateFlow<List<WearMetric>> = _dashboard

    private val _nutrients = MutableStateFlow<List<WearNutrient>>(emptyList())
    val nutrients: StateFlow<List<WearNutrient>> = _nutrients

    private val _programs = MutableStateFlow<List<WearProgram>>(emptyList())
    val programs: StateFlow<List<WearProgram>> = _programs
    private var programsUpdatedAt = 0.0

    /** The weight the phone last recorded, in kg, so the entry screen opens on it. */
    private val _weight = MutableStateFlow<Double?>(null)
    val weight: StateFlow<Double?> = _weight

    private val _weightUnit = MutableStateFlow("kg")
    val weightUnit: StateFlow<String> = _weightUnit

    /** "km" or "miles", the unit the phone shows distance in. */
    private val _distanceUnit = MutableStateFlow("km")
    val distanceUnit: StateFlow<String> = _distanceUnit

    /** When the phone built the snapshot, in epoch ms; 0 before the first one. */
    private val _updatedAt = MutableStateFlow(0L)
    val updatedAt: StateFlow<Long> = _updatedAt

    private val _phoneReachable = MutableStateFlow(false)
    val phoneReachable: StateFlow<Boolean> = _phoneReachable

    private val _phoneMetrics = MutableStateFlow<WearPhoneMetrics?>(null)
    val phoneMetrics: StateFlow<WearPhoneMetrics?> = _phoneMetrics

    /**
     * The last thing that went wrong, worth saying on the wrist — the Apple
     * Watch's `lastError`. A failure on the watch cannot be shown by the phone.
     */
    private val _lastError = MutableStateFlow<String?>(null)
    val lastError: StateFlow<String?> = _lastError

    fun setPhoneReachable(value: Boolean) {
        _phoneReachable.value = value
    }

    fun setError(message: String?) {
        _lastError.value = message
    }

    fun onMessage(path: String, body: String) {
        val json = runCatching { JSONObject(body) }.getOrNull() ?: return
        when (path) {
            WearLink.PATH_DASHBOARD -> readDashboard(json)
            WearLink.PATH_PROGRAMS -> readPrograms(json)
            WearLink.PATH_METRICS -> readMetrics(json)
        }
    }

    fun clearPhoneMetrics() {
        _phoneMetrics.value = null
    }

    /**
     * Shows a saved entry straight away rather than waiting for the phone's
     * next snapshot, the way `optimisticMeasurements` does on the Apple Watch.
     * The next snapshot overwrites it with the phone's own figure.
     */
    fun applySavedMeasurement(kind: String, value: Double) {
        if (kind == "weight") {
            _weight.value = value
            return
        }
        _dashboard.value = _dashboard.value.map { metric ->
            if (metric.label == "Water") metric.copy(value = metric.value + value) else metric
        }
    }

    private fun readDashboard(json: JSONObject) {
        val updatedAt = json.optDouble("updatedAt").takeIf { !it.isNaN() }?.toLong()
            ?: System.currentTimeMillis()
        if (updatedAt < _updatedAt.value) return
        val distanceUnit = json.optString("distanceUnit", "km").ifEmpty { "km" }
        _distanceUnit.value = distanceUnit
        _dashboard.value = listOfNotNull(
            metric("Move", json, "move", "moveGoal", "kcal"),
            metric("Exercise", json, "exercise", "exerciseGoal", "min"),
            metric("Steps", json, "steps", "stepsGoal", ""),
            metric("Distance", json, "distance", null, if (distanceUnit == "miles") "mi" else "km"),
            metric("Calories", json, "calories", "calorieGoal", "kcal"),
            metric("Water", json, "water", "waterGoal", "ml"),
        )
        _nutrients.value = buildList {
            val array = json.optJSONArray("nutrients") ?: JSONArray()
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                add(
                    WearNutrient(
                        key = item.optString("key"),
                        label = item.optString("label"),
                        consumed = item.optDouble("consumed", 0.0),
                        goal = item.optDouble("goal", 0.0),
                        unit = item.optString("unit"),
                        goalStep = item.optDouble("goalStep", 2.0).takeIf { it > 0 } ?: 2.0,
                        goalMaximum = item.optDouble("goalMaximum").takeIf { !it.isNaN() && it > 0 },
                        color = item.optLong("color", 0xFFFFFFFFL),
                    )
                )
            }
        }
        json.optDouble("weight").takeIf { !it.isNaN() && it > 0 }?.let { _weight.value = it }
        json.optString("weightUnit").takeIf { it.isNotEmpty() }?.let { _weightUnit.value = it }
        _updatedAt.value = updatedAt
    }

    /** Dropped when there is nothing to show, rather than rendering a zero. */
    private fun metric(
        label: String,
        json: JSONObject,
        valueKey: String,
        goalKey: String?,
        unit: String,
    ): WearMetric? {
        val value = json.optDouble(valueKey).takeIf { !it.isNaN() } ?: return null
        val goal = goalKey?.let { json.optDouble(it).takeIf { g -> !g.isNaN() && g > 0 } }
        if (value == 0.0 && goal == null) return null
        return WearMetric(label, value, goal, unit)
    }

    private fun readPrograms(json: JSONObject) {
        val array = json.optJSONArray("programs") ?: return
        val updatedAt = json.optDouble("updatedAt", 0.0)
        if (updatedAt < programsUpdatedAt) return
        programsUpdatedAt = updatedAt
        _programs.value = buildList {
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                val exercises = item.optJSONArray("exercises") ?: JSONArray()
                add(
                    WearProgram(
                        id = item.opt("id")?.toString() ?: "",
                        name = item.optString("name"),
                        expiresAt = item.optString("expiresAt").takeIf { it.isNotEmpty() && it != "null" },
                        exercises = buildList {
                            for (e in 0 until exercises.length()) {
                                val exercise = exercises.optJSONObject(e) ?: continue
                                add(WearExercise(exercise.optString("name"), readSets(exercise)))
                            }
                        },
                    )
                )
            }
        }
    }

    private fun readSets(exercise: JSONObject): List<WearSetTarget> {
        val sets = exercise.optJSONArray("sets") ?: return emptyList()
        return buildList {
            for (index in 0 until sets.length()) {
                val set = sets.optJSONObject(index) ?: continue
                add(
                    WearSetTarget(
                        reps = set.number("reps"),
                        weight = set.number("weight"),
                        duration = set.number("duration"),
                        distance = set.number("distance"),
                        rest = set.number("rest"),
                        notes = set.optString("notes").takeIf { it.isNotBlank() && it != "null" },
                    )
                )
            }
        }
    }

    private fun readMetrics(json: JSONObject) {
        val timestamp = json.optDouble("timestamp", 0.0).toLong()
        val current = _phoneMetrics.value
        if (current != null && timestamp < current.timestamp) return
        val sessionId = json.optString("sessionId").takeIf { it.isNotEmpty() }
        if (current?.sessionId != null && sessionId != null && sessionId != current.sessionId &&
            timestamp - current.timestamp < STALE_SESSION_MS
        ) return
        _phoneMetrics.value = WearPhoneMetrics(
            sessionId = sessionId,
            startedAt = json.optDouble("startedAt", 0.0).toLong(),
            timestamp = timestamp,
            phase = json.optString("phase", "recording"),
            elapsed = json.optDouble("elapsed", 0.0),
            distance = json.optDouble("distance", 0.0),
            speed = json.optDouble("speed", 0.0),
            maxSpeed = json.optDouble("maxSpeed", 0.0),
            elevationGain = json.optDouble("elevationGain", 0.0),
            calories = json.optDouble("calories", 0.0),
        )
    }

    private fun JSONObject.number(key: String): Double? =
        optDouble(key).takeIf { !it.isNaN() }

    private const val STALE_SESSION_MS = 120_000L
}

/** m:ss under an hour, h:mm:ss past it, the way `watchClock` formats. */
internal fun clock(seconds: Double): String {
    val whole = seconds.coerceAtLeast(0.0).toLong()
    return if (whole >= 3600) {
        String.format(java.util.Locale.US, "%d:%02d:%02d", whole / 3600, (whole / 60) % 60, whole % 60)
    } else {
        String.format(java.util.Locale.US, "%d:%02d", whole / 60, whole % 60)
    }
}
