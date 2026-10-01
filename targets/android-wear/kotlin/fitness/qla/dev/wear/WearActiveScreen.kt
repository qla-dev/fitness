package fitness.qla.dev.wear

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.FilledTonalButton
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

/**
 * The session, while it is running on the wrist.
 *
 * Shows what the sensors are reading and nothing else: on a watch mid-effort
 * the figures have to be legible at a glance and the controls hittable without
 * looking. The same four readings the Apple Watch shows, in the same order.
 *
 * Totals are pushed to the phone as they change rather than at the end, so a
 * watch that runs out of battery mid-run still leaves the phone holding most
 * of the session.
 */
@Composable
fun WearActiveScreen(sport: WearSport, onFinished: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val phase by WearHealth.phase.collectAsState()
    val metrics by WearHealth.metrics.collectAsState()

    // Every reading the watch takes is also sent on, so the phone's copy of the
    // session keeps up with the wrist rather than arriving in one lump at the
    // end.
    LaunchedEffect(metrics) {
        if (phase == WearSessionPhase.Running) {
            WearWorkout.pushMetrics(context, sport, metrics)
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = elapsed(metrics.elapsedMillis),
            style = MaterialTheme.typography.displayMedium,
        )
        Reading(
            value = metrics.heartRate?.toString() ?: "–",
            unit = "BPM",
        )
        Reading(
            value = format(metrics.distanceMeters / 1000.0),
            unit = "KM",
        )
        Reading(
            value = format(metrics.calories),
            unit = "KCAL",
        )

        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            FilledTonalButton(onClick = {
                scope.launch {
                    if (phase == WearSessionPhase.Paused) WearHealth.resume(context)
                    else WearHealth.pause(context)
                }
            }) {
                Text(if (phase == WearSessionPhase.Paused) "Resume" else "Pause")
            }
            Button(onClick = {
                scope.launch {
                    WearHealth.end(context)
                    WearWorkout.finish(context, sport, WearHealth.metrics.value)
                    WearHealth.reset()
                    onFinished()
                }
            }) { Text("Finish") }
        }

        if (phase == WearSessionPhase.Paused) {
            Text(
                text = "Paused",
                style = MaterialTheme.typography.labelSmall,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
    }
}

@Composable
private fun Reading(value: String, unit: String) {
    Row(verticalAlignment = Alignment.Bottom) {
        Text(text = value, style = MaterialTheme.typography.titleMedium)
        Text(
            text = " $unit",
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(bottom = 2.dp),
        )
    }
}

/** mm:ss under an hour, h:mm:ss past it — a run is read in minutes. */
private fun elapsed(millis: Long): String {
    val totalSeconds = TimeUnit.MILLISECONDS.toSeconds(millis)
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) String.format("%d:%02d:%02d", hours, minutes, seconds)
    else String.format("%02d:%02d", minutes, seconds)
}
