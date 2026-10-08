package fitness.qla.dev.wear

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListScope
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.AlertDialog
import androidx.wear.compose.material3.AlertDialogDefaults
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.ButtonDefaults
import androidx.wear.compose.material3.CircularProgressIndicator
import androidx.wear.compose.material3.FilledTonalButton
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * The session, while it is running on the wrist — `WatchActiveView.swift`.
 *
 * Pages, swiped as on the Apple Watch: the program's current set when one is
 * being walked, then the live figures, then the details with the controls.
 * The live page keeps to what is legible mid-effort; everything that is only
 * worth a look afterwards sits one swipe away.
 *
 * A phone-started session reads the phone's recorder for distance, pace and
 * calories and the wrist's sensor for heart rate. It is paused and finished on
 * the phone, which owns it, so its details page says so instead of offering
 * controls that would split the session in two.
 */
@Composable
fun WearActiveScreen(session: WearActiveSession) {
    val context = LocalContext.current
    val phase by WearHealth.phase.collectAsState()
    val metrics by WearHealth.metrics.collectAsState()

    // Every reading the watch takes is also sent on, so the phone's copy of the
    // session keeps up with the wrist — heart rate for a phone session, the
    // whole set of totals for one recorded here.
    LaunchedEffect(metrics) {
        if (phase == WearSessionPhase.Running) {
            WearWorkout.pushMetrics(context, session.sport, metrics)
        }
    }

    val pages = buildList {
        if (session.program != null) add(ActivePage.Program)
        add(ActivePage.Live)
        add(ActivePage.Details)
    }
    val pagerState = rememberPagerState(pageCount = { pages.size })

    HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { index ->
        when (pages[index]) {
            ActivePage.Program -> session.program?.let { ProgramPage(it) }
            ActivePage.Live -> LivePage(session)
            ActivePage.Details -> DetailsPage(session)
        }
    }
}

private enum class ActivePage { Program, Live, Details }

/** Ticks once a second, for figures that count on between updates. */
@Composable
private fun rememberNow(): Long {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            now = System.currentTimeMillis()
            delay(1_000)
        }
    }
    return now
}

/** Distance and pace in the unit the phone shows them in. */
private class Units(miles: Boolean) {
    val metresPerUnit = if (miles) 1609.344 else 1000.0
    val distance = if (miles) "mi" else "km"
    val speed = if (miles) "mph" else "km/h"
    val elevation = if (miles) "ft" else "m"
    val elevationFactor = if (miles) 3.28084 else 1.0
}

@Composable
private fun LivePage(session: WearActiveSession) {
    val metrics by WearHealth.metrics.collectAsState()
    val phase by WearHealth.phase.collectAsState()
    val phone by WearState.phoneMetrics.collectAsState()
    val distanceUnit by WearState.distanceUnit.collectAsState()
    val now = rememberNow()
    val units = Units(distanceUnit == "miles")
    val isPhone = session.origin == SessionOrigin.Phone
    val hasMetrics = !isPhone || phone != null
    val paused = if (isPhone) phone?.phase == "paused" else phase == WearSessionPhase.Paused
    val fresh = phone?.let { now - it.timestamp < 15_000 } ?: false
    val distance = if (isPhone) phone?.distance ?: 0.0 else metrics.distanceMeters

    val elapsed = when {
        !hasMetrics -> PLACEHOLDER
        !isPhone -> clock(metrics.elapsedMillis / 1000.0)
        else -> phone!!.let { reading ->
            val extra = if (!paused) ((now - reading.timestamp) / 1000.0).coerceIn(0.0, 15.0) else 0.0
            clock(reading.elapsed + extra)
        }
    }

    val pace: String = run {
        if (!hasMetrics) return@run PLACEHOLDER
        val speed = if (isPhone) {
            if (!fresh || paused) return@run PLACEHOLDER
            phone!!.speed
        } else {
            distance / (metrics.elapsedMillis / 1000.0).coerceAtLeast(1.0)
        }
        if (speed <= 0.5) return@run PLACEHOLDER
        if (session.sport.readsSpeed) formatOne(speed * 3600 / units.metresPerUnit)
        else clock(units.metresPerUnit / speed)
    }
    val paceLabel = when {
        session.sport.readsSpeed -> if (isPhone) "Speed · ${units.speed}" else "Avg speed · ${units.speed}"
        else -> if (isPhone) "Pace · min/${units.distance}" else "Avg pace · min/${units.distance}"
    }

    PageColumn {
        if (session.program == null) {
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    WatchMetric(paceLabel, pace, valueSize = 20.sp, labelLines = 2, modifier = Modifier.weight(1f))
                    WatchMetric(
                        "Distance · ${units.distance}",
                        if (hasMetrics) formatTwo(distance / units.metresPerUnit) else PLACEHOLDER,
                        valueSize = 20.sp,
                        labelLines = 2,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
        item {
            Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = metrics.heartRate?.toString() ?: PLACEHOLDER,
                    fontSize = 52.sp,
                    fontWeight = FontWeight.Normal,
                    maxLines = 1,
                )
                Spacer(modifier = Modifier.width(4.dp))
                QlaIcon(WearIcon.Heart, tint = SwiftColor.Pink, size = 16.dp, modifier = Modifier.padding(bottom = 10.dp))
                Spacer(modifier = Modifier.width(2.dp))
                Text(
                    text = "BPM",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 10.dp),
                )
            }
        }
        item { WatchMetric("Elapsed", elapsed, color = SwiftColor.Yellow, modifier = Modifier.fillMaxWidth()) }
        if (paused) {
            item { Text("Paused", color = SwiftColor.Yellow, modifier = Modifier.fillMaxWidth()) }
        }
        if (isPhone && !fresh) {
            item { Note("Waiting for live data from your phone") }
        }
    }
}

@Composable
private fun DetailsPage(session: WearActiveSession) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val metrics by WearHealth.metrics.collectAsState()
    val phase by WearHealth.phase.collectAsState()
    val phone by WearState.phoneMetrics.collectAsState()
    val distanceUnit by WearState.distanceUnit.collectAsState()
    val units = Units(distanceUnit == "miles")
    val isPhone = session.origin == SessionOrigin.Phone
    val hasMetrics = !isPhone || phone != null
    var confirmStop by remember { mutableStateOf(false) }

    PageColumn {
        item {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                QlaIcon(session.sport.glyph, tint = session.sport.tint, size = 12.dp)
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = session.program?.name ?: session.sport.label,
                    fontSize = 11.sp,
                    color = session.sport.tint,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        item {
            WatchMetric(
                if (isPhone) "Estimated calories" else "Active calories",
                if (hasMetrics) "${format(if (isPhone) phone!!.calories else metrics.calories)} kcal" else PLACEHOLDER,
                color = SwiftColor.Orange,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            WatchMetric(
                "Average heart rate",
                metrics.averageHeartRate?.let { "$it BPM" } ?: PLACEHOLDER,
                color = SwiftColor.Pink,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            WatchMetric(
                "Maximum heart rate",
                metrics.maxHeartRate?.let { "$it BPM" } ?: PLACEHOLDER,
                color = SwiftColor.Pink,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (isPhone) {
            item {
                WatchMetric(
                    "Maximum speed",
                    phone?.let { "${formatOne(it.maxSpeed * 3600 / units.metresPerUnit)} ${units.speed}" } ?: PLACEHOLDER,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                WatchMetric(
                    "Elevation gain",
                    phone?.let { "${format(Math.round(it.elevationGain * units.elevationFactor).toDouble())} ${units.elevation}" }
                        ?: PLACEHOLDER,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item { Note("Pause or finish this workout on your phone.") }
        } else {
            item {
                FilledTonalButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        scope.launch {
                            if (phase == WearSessionPhase.Paused) WearSession.resume(context)
                            else WearSession.pause(context)
                        }
                    },
                    icon = { QlaIcon(if (phase == WearSessionPhase.Paused) WearIcon.Play else WearIcon.Pause) },
                    label = { Text(if (phase == WearSessionPhase.Paused) "Resume" else "Pause") },
                )
            }
            item {
                Button(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { confirmStop = true },
                    colors = ButtonDefaults.buttonColors(containerColor = SwiftColor.Red, contentColor = Color.White),
                    icon = { QlaIcon(WearIcon.Stop, tint = Color.White) },
                    label = { Text("Stop") },
                )
            }
        }
        item { ErrorNote() }
    }

    // Asked before anything ends, as `confirmationDialog` does on the Apple
    // Watch: a stop pressed by a sleeve mid-run must not end the session.
    AlertDialog(
        visible = confirmStop,
        onDismissRequest = { confirmStop = false },
        title = { Text("Finish this workout?", textAlign = TextAlign.Center) },
        text = { Text("Finish and save", textAlign = TextAlign.Center) },
        confirmButton = {
            AlertDialogDefaults.ConfirmButton(onClick = {
                confirmStop = false
                scope.launch { WearSession.finishFromWatch(context) }
            })
        },
        dismissButton = {
            AlertDialogDefaults.DismissButton(onClick = { confirmStop = false })
        },
    )
}

/** The current set of the program being walked — `WatchProgramActiveView`. */
@Composable
private fun ProgramPage(program: WearProgram) {
    val step by WearSession.programStep.collectAsState()
    val restUntil by WearSession.restUntil.collectAsState()
    val haptics = LocalHapticFeedback.current
    val now = rememberNow()
    val steps = program.steps

    PageColumn {
        item { Text(program.name, style = MaterialTheme.typography.titleSmall, modifier = Modifier.fillMaxWidth()) }
        if (step < steps.size) {
            val current = steps[step]
            item { Text(current.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.fillMaxWidth()) }
            item { Text("Set ${current.number}", modifier = Modifier.fillMaxWidth()) }
            current.target.prescription.takeIf { it.isNotEmpty() }?.let { line ->
                item { Text(line, color = SwiftColor.Yellow, modifier = Modifier.fillMaxWidth()) }
            }
            current.target.notes?.let { notes ->
                item { Text(notes, fontSize = 10.sp, modifier = Modifier.fillMaxWidth()) }
            }
            restUntil?.takeIf { it > now }?.let { until ->
                item { Text("Rest ${clock((until - now) / 1000.0)}", modifier = Modifier.fillMaxWidth()) }
            }
            item {
                Button(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        if (WearSession.completeSet()) haptics.performHapticFeedback(HapticFeedbackType.Confirm)
                    },
                    label = { Text("Complete set") },
                )
            }
        } else {
            item { Note("All sets complete. Swipe to finish and save your workout.") }
        }
    }
}

/** The 3-2-1 before the live view — `CountdownView` on the Apple Watch. */
@Composable
fun WearCountdownScreen(sport: WearSport, seconds: Int) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(listOf(sport.tint.copy(alpha = 0.35f), Color.Transparent), radius = 330f)
            ),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            QlaIcon(sport.glyph, tint = sport.tint, size = 26.dp)
            Spacer(modifier = Modifier.height(6.dp))
            Text(text = seconds.toString(), fontSize = 64.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = sport.label.uppercase(),
                fontSize = 11.sp,
                letterSpacing = 1.2.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Between Finish and the pages coming back, while the totals go to the phone. */
@Composable
fun WearSavingScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator()
            Spacer(modifier = Modifier.height(8.dp))
            Text("Saving workout…", style = MaterialTheme.typography.labelSmall)
        }
    }
}

/** A small label over one figure — `WatchMetric` on the Apple Watch. */
@Composable
internal fun WatchMetric(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurface,
    valueSize: TextUnit = 24.sp,
    labelLines: Int = 1,
) {
    Column(modifier = modifier) {
        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = labelLines,
            overflow = TextOverflow.Ellipsis,
        )
        Text(text = value, fontSize = valueSize, fontWeight = FontWeight.Medium, color = color, maxLines = 1)
    }
}

@Composable
private fun Note(text: String) {
    Text(
        text = text,
        fontSize = 11.sp,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.fillMaxWidth(),
    )
}

/** Each page scrolls on its own, as the Digital Crown does page by page. */
@Composable
private fun PageColumn(content: ScalingLazyListScope.() -> Unit) {
    ScalingLazyColumn(
        state = rememberScalingLazyListState(initialCenterItemIndex = 1),
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.Start,
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = roundContentPadding(),
        content = content,
    )
}

private fun formatOne(value: Double): String = String.format(java.util.Locale.US, "%.1f", value)

private fun formatTwo(value: Double): String = String.format(java.util.Locale.US, "%.2f", value)
