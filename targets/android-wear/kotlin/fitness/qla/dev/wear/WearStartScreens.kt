package fitness.qla.dev.wear

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListState
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material3.FilledTonalButton
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.launch

/**
 * Everything a session can be started as.
 *
 * The phone's whole catalogue rather than the two GPS sports it used to show:
 * `WORKOUT_SPORTS` has eighteen, grouped by what the effort is going to be
 * like, and a watch that offered two of them read as a different product from
 * the phone in the same pocket. Grouped and ordered exactly as the phone
 * orders them, with the phone's own icons.
 */
@Composable
fun WearSportsScreen(listState: ScalingLazyListState, onStarted: (WearSport) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val reachable by WearState.phoneReachable.collectAsState()
    val supportedTypes by WearHealth.supportedTypes.collectAsState()

    LaunchedEffect(Unit) { WearHealth.refreshSupport(context) }

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
        verticalArrangement = Arrangement.spacedBy(4.dp),
        contentPadding = roundContentPadding(),
    ) {
        item { ScreenTitle("Start") }
        item {
            Text(
                // Says which of the two is about to happen, because they are
                // not the same session: one is traced by the phone's GPS, the
                // other is the wrist's own sensors.
                text = if (reachable) {
                    "Recorded on your watch, sent to your phone."
                } else {
                    "No phone nearby. This watch will record it."
                },
                style = MaterialTheme.typography.labelSmall,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        WearSportGroup.entries.forEach { group ->
            val sports = WearSportCatalogue.inGroup(group)
                .filter { supportedTypes == null || WearHealth.supports(it) }
            if (sports.isEmpty()) return@forEach
            item(key = "group-${group.name}") { GroupHeading(group.title) }
            items(sports, key = { it.id }) { sport ->
                FilledTonalButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        scope.launch {
                            // Started here in every case. The watch owns the
                            // sensors, so this is the half that can actually
                            // begin; the phone is told separately and adopts
                            // the totals as they arrive.
                            if (WearHealth.start(context, sport)) {
                                onStarted(sport)
                                if (reachable) {
                                    WearWorkout.requestFromPhone(context, sport)
                                }
                            }
                        }
                    },
                    icon = { QlaIcon(sport.glyph) },
                    label = { Text(sport.label) },
                )
            }
        }
    }
}

@Composable
private fun GroupHeading(title: String) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = title.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
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
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                QlaIcon(WearIcon.Barbell, size = 28.dp)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Open qla.fit on your phone to sync your programs.",
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center,
                )
            }
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
        item { ScreenTitle("Programs") }
        items(programs, key = { it.id }) { program ->
            Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Text(text = program.name, style = MaterialTheme.typography.bodyMedium)
                Text(
                    text = "${program.exercises.size} exercises",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
