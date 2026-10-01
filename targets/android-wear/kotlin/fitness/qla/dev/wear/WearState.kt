package fitness.qla.dev.wear

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject

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
)

/** One movement inside a program. */
data class WearExercise(val name: String, val sets: Int)

/** A saved workout program, as the phone stores it. */
data class WearProgram(
    val id: String,
    val name: String,
    val exercises: List<WearExercise>,
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

    /** The weight the phone last recorded, so the entry screen opens on it. */
    private val _weight = MutableStateFlow<Double?>(null)
    val weight: StateFlow<Double?> = _weight

    private val _weightUnit = MutableStateFlow("kg")
    val weightUnit: StateFlow<String> = _weightUnit

    private val _updatedAt = MutableStateFlow(0L)
    val updatedAt: StateFlow<Long> = _updatedAt

    private val _phoneReachable = MutableStateFlow(false)
    val phoneReachable: StateFlow<Boolean> = _phoneReachable

    fun setPhoneReachable(value: Boolean) {
        _phoneReachable.value = value
    }

    fun onMessage(path: String, body: String) {
        val json = runCatching { JSONObject(body) }.getOrNull() ?: return
        when (path) {
            WearLink.PATH_DASHBOARD -> readDashboard(json)
            WearLink.PATH_PROGRAMS -> readPrograms(json)
        }
    }

    private fun readDashboard(json: JSONObject) {
        val distanceUnit = json.optString("distanceUnit", "km")
        _dashboard.value = listOfNotNull(
            metric("Move", json, "move", "moveGoal", "kcal"),
            metric("Exercise", json, "exercise", "exerciseGoal", "min"),
            metric("Steps", json, "steps", "stepsGoal", ""),
            metric("Distance", json, "distance", null, distanceUnit),
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
                        goalStep = item.optDouble("goalStep", 1.0),
                    )
                )
            }
        }
        json.optDouble("weight").takeIf { !it.isNaN() && it > 0 }?.let { _weight.value = it }
        json.optString("weightUnit").takeIf { it.isNotEmpty() }?.let { _weightUnit.value = it }
        _updatedAt.value = System.currentTimeMillis()
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
        _programs.value = buildList {
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                val exercises = item.optJSONArray("exercises") ?: JSONArray()
                add(
                    WearProgram(
                        id = item.opt("id")?.toString() ?: "",
                        name = item.optString("name"),
                        exercises = buildList {
                            for (e in 0 until exercises.length()) {
                                val exercise = exercises.optJSONObject(e) ?: continue
                                add(
                                    WearExercise(
                                        name = exercise.optString("name"),
                                        sets = exercise.optJSONArray("sets")?.length() ?: 0,
                                    )
                                )
                            }
                        },
                    )
                )
            }
        }
    }
}
