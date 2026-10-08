package fitness.qla.dev.wear

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListState
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.launch

/**
 * Everything a session can be started as.
 *
 * The phone's whole catalogue, grouped and ordered exactly as the phone orders
 * them. Each row is the sport's mark on a disc of its own colour, as
 * `SportRow` draws it on the Apple Watch: eighteen rows of plain text are not
 * scannable on a screen this size, eighteen colours are.
 */
@Composable
fun WearSportsScreen(listState: ScalingLazyListState) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val reachable by WearState.phoneReachable.collectAsState()
    val supportedTypes by WearHealth.supportedTypes.collectAsState()
    val finishing by WearSession.finishing.collectAsState()

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
                SportRow(sport = sport, enabled = !finishing) {
                    scope.launch { WearSession.startFromWatch(context, sport) }
                }
            }
        }
        item { ErrorNote() }
    }
}

/** One sport: its mark in its own colour on a tinted disc, then its name. */
@Composable
private fun SportRow(sport: WearSport, enabled: Boolean, onStart: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(26.dp))
            .background(MaterialTheme.colorScheme.surfaceContainer)
            .clickable(enabled = enabled, onClick = onStart)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(30.dp)
                .clip(CircleShape)
                .background(sport.tint.copy(alpha = 0.22f)),
            contentAlignment = Alignment.Center,
        ) {
            QlaIcon(sport.glyph, tint = sport.tint, size = 16.dp)
        }
        Spacer(modifier = Modifier.width(10.dp))
        Text(text = sport.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
 * The saved programs, what is in them, and a way to start one —
 * `WatchProgramsView`. Starting walks the program set by set as a strength
 * session, the way `startProgram` does on the Apple Watch.
 */
@Composable
fun WearProgramsScreen(listState: ScalingLazyListState) {
    val programs by WearState.programs.collectAsState()
    var openId by remember { mutableStateOf<String?>(null) }
    val open = programs.firstOrNull { it.id == openId }

    if (open != null) {
        ProgramDetail(open, listState, onBack = { openId = null })
        return
    }

    if (programs.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                QlaIcon(WearIcon.Barbell, size = 28.dp)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Add programs on your phone to sync them here.",
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
        item { ScreenTitle("My Programs") }
        items(programs, key = { it.id }) { program ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(26.dp))
                    .background(MaterialTheme.colorScheme.surfaceContainer)
                    .clickable { openId = program.id }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                QlaIcon(WearIcon.Barbell, tint = SwiftColor.Blue, size = 16.dp)
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                    Text(program.name, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(
                        text = "${program.exercises.size} exercises",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun ProgramDetail(program: WearProgram, listState: ScalingLazyListState, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val finishing by WearSession.finishing.collectAsState()
    val canStart = !program.expired && program.steps.isNotEmpty() && !finishing

    LaunchedEffect(program.id) { listState.scrollToItem(0) }

    ScalingLazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.Start,
        verticalArrangement = Arrangement.spacedBy(6.dp),
        contentPadding = roundContentPadding(),
    ) {
        item {
            Text(
                text = "‹ My Programs",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clickable(onClick = onBack).padding(vertical = 4.dp),
            )
        }
        item { Text(program.name, style = MaterialTheme.typography.titleMedium) }
        item {
            Button(
                modifier = Modifier.fillMaxWidth(),
                enabled = canStart,
                onClick = {
                    scope.launch {
                        WearSession.startFromWatch(context, WearSportCatalogue.strength, program)
                    }
                },
                label = { Text("Start program") },
            )
        }
        if (program.expired) {
            item { Text("This program has expired.", fontSize = 11.sp) }
        }
        program.exercises.forEachIndexed { exerciseIndex, exercise ->
            item(key = "exercise-$exerciseIndex") {
                Text(
                    text = exercise.name.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            exercise.sets.forEachIndexed { setIndex, set ->
                item(key = "set-$exerciseIndex-$setIndex") {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(MaterialTheme.colorScheme.surfaceContainer)
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                    ) {
                        Text("Set ${setIndex + 1}")
                        set.prescription.takeIf { it.isNotEmpty() }?.let {
                            Text(it, fontSize = 12.sp)
                        }
                        set.notes?.let {
                            Text(it, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
        item { ErrorNote() }
    }
}
