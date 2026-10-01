package fitness.qla.dev.wear

import android.content.Context
import org.json.JSONObject

/**
 * What the phone is told about a session.
 *
 * Two ways in, mirroring the Apple Watch. A session can be *asked for* — the
 * phone opens it, records the GPS trace and owns the diary row, and the watch
 * is a remote. Or it can be *recorded here*, when the phone is not in reach,
 * and then the watch sends what its sensors read so the phone can write the
 * same row afterwards.
 *
 * Either way the phone writes the diary. The watch never does, which is what
 * keeps one effort from becoming two rows.
 */
object WearWorkout {
    /** Asks the phone to open a session and record it. */
    suspend fun requestFromPhone(context: Context, sport: WearSport): Boolean {
        val body = JSONObject()
            .put("sport", sport.id)
            .put("requestedAt", System.currentTimeMillis())
        return WearLink.send(
            context,
            WearLink.PATH_REQUEST_WORKOUT,
            body.toString().toByteArray(),
        )
    }

    /**
     * Sends what the wrist is reading, mid-session.
     *
     * Best effort on purpose: out of range this fails and the session carries
     * on, because the readings are the watch's own and losing one update is not
     * losing the run. The totals are cumulative, so the next update that lands
     * brings the phone fully up to date.
     */
    suspend fun pushMetrics(
        context: Context,
        sport: WearSport,
        metrics: WearLiveMetrics,
    ) {
        WearLink.send(
            context,
            WearLink.PATH_HEART_RATE,
            body(sport, metrics).put("phase", "recording").toString().toByteArray(),
        )
    }

    /** The final totals, for the phone to write as an exercise. */
    suspend fun finish(
        context: Context,
        sport: WearSport,
        metrics: WearLiveMetrics,
    ): Boolean = WearLink.send(
        context,
        WearLink.PATH_STATE,
        body(sport, metrics).put("phase", "finished").toString().toByteArray(),
    )

    private fun body(sport: WearSport, metrics: WearLiveMetrics) = JSONObject()
        .put("sport", sport.id)
        .put("timestamp", System.currentTimeMillis())
        .put("elapsed", metrics.elapsedMillis / 1000)
        .put("distance", metrics.distanceMeters)
        .put("calories", metrics.calories)
        .apply { metrics.heartRate?.let { put("bpm", it) } }
}
