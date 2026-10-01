package fitness.qla.dev.wear

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListScope
import androidx.wear.compose.foundation.lazy.ScalingLazyListState
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.launch

/**
 * The sports a session can be started as.
 *
 * The same two the phone recorder knows, named the same way: the watch asks
 * the phone to open the session rather than opening one itself, so a run
 * started here is the same row in the diary as one started there.
 */
enum class WearSport(val id: String, val label: String) {
    Run("run", "Running"),
    Ride("ride", "Cycling"),
}

@Composable
fun WearSportsScreen(listState: ScalingLazyListState, onStarted: (WearSport) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val reachable by WearState.phoneReachable.collectAsState()
    val canRecordHere by WearHealth.supported.collectAsState()

    LaunchedEffect(Unit) { WearHealth.refreshSupport(context, WearSport.Run) }

    // Health Services refuses a session without these, and refuses it quietly
    // — the exercise simply never starts. Asked here, before a sport is
    // tapped, so the answer is in hand by the time one is.
    val permissions = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { }
    LaunchedEffect(Unit) { permissions.launch(WearHealth.REQUIRED_PERMISSIONS) }

    ScalingLazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
        contentPadding = roundContentPadding(),
    ) {
        item { Text(text = "Start", style = MaterialTheme.typography.titleMedium) }
        items(WearSport.entries) { sport ->
            Button(
                modifier = Modifier.fillMaxWidth(),
                // Startable whenever either half can carry the session: the
                // phone when it is in reach, this watch when it is not.
                enabled = reachable || canRecordHere == true,
                onClick = {
                    scope.launch {
                        if (reachable) {
                            WearWorkout.requestFromPhone(context, sport)
                        } else if (WearHealth.start(context, sport)) {
                            onStarted(sport)
                        }
                    }
                },
            ) { Text(sport.label) }
        }
        if (!reachable) {
            item {
                Text(
                    // Says which of the two is about to happen, because they
                    // are not the same session: one is traced by the phone's
                    // GPS, the other is the wrist's own sensors.
                    text = if (canRecordHere == true) {
                        "No phone nearby. This watch will record it."
                    } else {
                        "Connect your phone to start a session."
                    },
                    style = MaterialTheme.typography.labelSmall,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

/**
 * The saved programs, and what is in them.
 *
 * Read-only on the watch for now, the way the Apple Watch started: seeing the
 * next movement and its sets is most of the value on a wrist, and completing a
 * set writes to the phone's active session, which the recorder owns.
 */
@Composable
fun WearProgramsScreen(listState: ScalingLazyListState) {
    val programs by WearState.programs.collectAsState()

    if (programs.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Open qla.fit on your phone to sync your programs.",
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
            )
        }
        return
    }

    ScalingLazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
        contentPadding = roundContentPadding(),
    ) {
        item { Text(text = "Programs", style = MaterialTheme.typography.titleMedium) }
        items(programs) { program ->
            Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Text(text = program.name, style = MaterialTheme.typography.bodyMedium)
                Text(
                    text = "${program.exercises.size} exercises",
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
    }
}
