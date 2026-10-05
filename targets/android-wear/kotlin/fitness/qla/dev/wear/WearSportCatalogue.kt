package fitness.qla.dev.wear

import androidx.health.services.client.data.ExerciseType

/**
 * How the list is sectioned, matching the phone's `SportGroup`.
 *
 * Deliberately not the exercise taxonomy the library uses: that one answers
 * "what muscle does this train", which is the wrong question when you are
 * picking what to start.
 */
enum class WearSportGroup(val title: String) {
    Moving("Moving"),
    Stationary("Stationary"),
    Ball("Ball"),
    Studio("Studio"),
    Strength("Strength"),
}

/**
 * One sport the watch can start.
 *
 * `id` must stay identical to the phone catalogue's, because it is what
 * crosses the Data Layer when a session is handed over — the same contract
 * `WatchSportCatalogue.swift` keeps on the Apple side.
 *
 * `recording` is set only for the two sports the phone records with GPS. The
 * rest have no phone recorder to hand off to, so they are always the watch's
 * own session.
 */
data class WearSport(
    val id: String,
    val label: String,
    val group: WearSportGroup,
    val glyph: Char,
    val exerciseType: ExerciseType,
    val recording: String? = null,
)

/**
 * Every sport the phone offers, in the phone's order.
 *
 * Mirrors `WORKOUT_SPORTS` in `src/constants/workoutSports.ts` one for one,
 * and is duplicated by hand for the same reason the message paths are: a Wear
 * module cannot import from the React Native side. The Apple Watch keeps the
 * same list in `targets/watch/WatchSportCatalogue.swift`, so all three move
 * together or the ids stop lining up.
 *
 * Health Services types are the nearest real entry rather than a guess —
 * every one below was read off the shipped `ExerciseType` class, because an
 * invented constant is a compile error and a wrong one silently records the
 * wrong activity. Two have no exact match: CrossFit files as BOOT_CAMP (its
 * circuit shape) and Elliptical keeps its own type, which not every watch
 * supports — `WearHealth` checks support per sport before offering it.
 */
object WearSportCatalogue {
    val all: List<WearSport> = listOf(
        WearSport(
            "running", "Running", WearSportGroup.Moving,
            WearIcon.Walk, ExerciseType.RUNNING, recording = "run",
        ),
        WearSport(
            "cycling", "Cycling", WearSportGroup.Moving,
            WearIcon.Bicycle, ExerciseType.BIKING, recording = "ride",
        ),
        WearSport(
            "walking", "Walking", WearSportGroup.Moving,
            WearIcon.WalkOutline, ExerciseType.WALKING,
        ),
        WearSport(
            "hiking", "Hiking", WearSportGroup.Moving,
            WearIcon.WalkOutline, ExerciseType.HIKING,
        ),
        WearSport(
            "swimming", "Swimming", WearSportGroup.Moving,
            WearIcon.Water, ExerciseType.SWIMMING_POOL,
        ),
        WearSport(
            "rowing", "Rowing", WearSportGroup.Stationary,
            WearIcon.Fitness, ExerciseType.ROWING_MACHINE,
        ),
        WearSport(
            "elliptical", "Elliptical", WearSportGroup.Stationary,
            WearIcon.Fitness, ExerciseType.ELLIPTICAL,
        ),
        WearSport(
            "stair-climbing", "Stair Climbing", WearSportGroup.Stationary,
            WearIcon.Fitness, ExerciseType.STAIR_CLIMBING_MACHINE,
        ),
        WearSport(
            "tennis", "Tennis", WearSportGroup.Ball,
            WearIcon.Tennis, ExerciseType.TENNIS,
        ),
        WearSport(
            "basketball", "Basketball", WearSportGroup.Ball,
            WearIcon.Basketball, ExerciseType.BASKETBALL,
        ),
        WearSport(
            "football", "Football", WearSportGroup.Ball,
            WearIcon.Football, ExerciseType.SOCCER,
        ),
        WearSport(
            "yoga", "Yoga", WearSportGroup.Studio,
            WearIcon.Body, ExerciseType.YOGA,
        ),
        WearSport(
            "pilates", "Pilates", WearSportGroup.Studio,
            WearIcon.Body, ExerciseType.PILATES,
        ),
        WearSport(
            "dancing", "Dancing", WearSportGroup.Studio,
            WearIcon.Fitness, ExerciseType.DANCING,
        ),
        WearSport(
            "boxing", "Boxing", WearSportGroup.Studio,
            WearIcon.Fitness, ExerciseType.BOXING,
        ),
        WearSport(
            "strength-training", "Strength Training", WearSportGroup.Strength,
            WearIcon.Barbell, ExerciseType.STRENGTH_TRAINING,
        ),
        WearSport(
            "crossfit", "CrossFit", WearSportGroup.Strength,
            WearIcon.Barbell, ExerciseType.BOOT_CAMP,
        ),
        WearSport(
            "hiit", "HIIT", WearSportGroup.Strength,
            WearIcon.Fitness, ExerciseType.HIGH_INTENSITY_INTERVAL_TRAINING,
        ),
    )

    /** In catalogue order, so a group's sports keep the phone's ordering. */
    fun inGroup(group: WearSportGroup): List<WearSport> =
        all.filter { it.group == group }

    fun byId(id: String?): WearSport? = all.firstOrNull { it.id == id }

    /** What a message names when it carries only the recording profile. */
    fun fallback(recording: String?): WearSport = when (recording) {
        "ride" -> byId("cycling")
        else -> byId("running")
    } ?: all.first()
}
