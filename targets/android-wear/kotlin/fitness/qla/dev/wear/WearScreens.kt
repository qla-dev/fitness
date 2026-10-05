package fitness.qla.dev.wear

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListScope
import androidx.wear.compose.foundation.lazy.ScalingLazyListState
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.CircularProgressIndicator
import androidx.wear.compose.material3.FilledTonalButton
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ProgressIndicatorDefaults
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.launch
import java.util.Locale
import kotlin.math.roundToInt

/**
 * The screens the Apple Watch already has, in the same order and saying the
 * same things — `targets/watch/` is the specification, so a person with one
 * watch on each wrist sees one app.
 *
 * A screen that has not heard from the phone shows its own shape with the
 * figures left blank, rather than a sentence where the day should be. The
 * rings, the rows and their icons are known before any data arrives, so
 * drawing them immediately and filling them in when the snapshot lands is
 * both quicker to read and honest about what is missing — an em dash is
 * visibly "not yet", where a zero would be a lie about the day.
 */

/** The ring colours, matching the three the phone and the Apple Watch use. */
private val MoveColor = Color(0xFFFF375F)
private val ExerciseColor = Color(0xFF3BD15F)
private val StepsColor = Color(0xFF4FD0E0)

/** One row of the dashboard, known before any data arrives. */
private data class DashboardSlot(
    val label: String,
    val glyph: Char,
    val color: Color,
)

private val DASHBOARD_SLOTS = listOf(
    DashboardSlot("Move", WearIcon.Flame, MoveColor),
    DashboardSlot("Exercise", WearIcon.Time, ExerciseColor),
    DashboardSlot("Steps", WearIcon.Footsteps, StepsColor),
    DashboardSlot("Distance", WearIcon.Navigate, StepsColor),
    DashboardSlot("Calories", WearIcon.Restaurant, MoveColor),
    DashboardSlot("Water", WearIcon.WaterFilled, StepsColor),
)

@Composable
fun WearDashboardScreen(listState: ScalingLazyListState) {
    val metrics by WearState.dashboard.collectAsState()
    val updatedAt by WearState.updatedAt.collectAsState()
    val synced = metrics.isNotEmpty()
    val byLabel = metrics.associateBy { it.label }

    ScreenColumn(listState) {
        item { ScreenTitle("Today") }
        item {
            ActivityRings(
                move = byLabel["Move"]?.fraction ?: 0f,
                exercise = byLabel["Exercise"]?.fraction ?: 0f,
                steps = byLabel["Steps"]?.fraction ?: 0f,
            )
        }
        if (!synced) {
            item { Caption("Waiting for your phone. Open qla.fit to fill this in.") }
        } else if (isStale(updatedAt)) {
            item { Caption("Showing the last synced day. Open the phone dashboard to update.") }
        }
        items(DASHBOARD_SLOTS, key = { it.label }) { slot ->
            MetricRow(slot, byLabel[slot.label])
        }
    }
}

/**
 * The three rings, drawn whether or not there is anything in them.
 *
 * Concentric and in the phone's order — Move outermost, then Exercise, then
 * Steps — so the glance is the same one the phone's card trains.
 */
@Composable
private fun ActivityRings(move: Float, exercise: Float, steps: Float) {
    Box(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(modifier = Modifier.size(84.dp), contentAlignment = Alignment.Center) {
            Ring(move, MoveColor, 84.dp)
            Ring(exercise, ExerciseColor, 62.dp)
            Ring(steps, StepsColor, 40.dp)
        }
    }
}

@Composable
private fun Ring(fraction: Float, color: Color, size: androidx.compose.ui.unit.Dp) {
    CircularProgressIndicator(
        progress = { fraction },
        modifier = Modifier.size(size),
        colors = ProgressIndicatorDefaults.colors(
            indicatorColor = color,
            // The unfilled part stays visible so an empty ring still reads as
            // a ring rather than as a missing element.
            trackColor = color.copy(alpha = 0.22f),
        ),
        strokeWidth = 6.dp,
    )
}

@Composable
private fun MetricRow(slot: DashboardSlot, metric: WearMetric?) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        QlaIcon(slot.glyph, tint = slot.color, size = 16.dp)
        Spacer(modifier = Modifier.width(8.dp))
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = slot.label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = metric?.let { value ->
                    buildString {
                        append(format(value.value))
                        value.goal?.let { append(" / ").append(format(it)) }
                        if (value.unit.isNotEmpty()) append(' ').append(value.unit)
                    }
                } ?: PLACEHOLDER,
                style = MaterialTheme.typography.bodyMedium,
                color = if (metric == null) {
                    MaterialTheme.colorScheme.onSurfaceVariant
                } else {
                    MaterialTheme.colorScheme.onSurface
                },
            )
        }
    }
}

/** The macros the phone tracks, so the screen has its shape before any data. */
private val NUTRIENT_PLACEHOLDERS = listOf("Calories", "Protein", "Carbs", "Fat")

@Composable
fun WearNutritionScreen(listState: ScalingLazyListState) {
    val nutrients by WearState.nutrients.collectAsState()

    ScreenColumn(listState) {
        item { ScreenTitle("Nutrition") }
        if (nutrients.isEmpty()) {
            item { Caption("Waiting for your phone. Open qla.fit to fill this in.") }
            items(NUTRIENT_PLACEHOLDERS, key = { it }) { label ->
                NutrientRow(label = label, value = PLACEHOLDER)
            }
        } else {
            items(nutrients, key = { it.key }) { nutrient ->
                NutrientRow(
                    label = nutrient.label,
                    // "left" rather than "eaten": on a wrist the useful number
                    // is what is still allowed, which is what the phone card
                    // shows too. With no goal there is nothing to subtract
                    // from, so the total stands on its own.
                    value = if (nutrient.goal > 0) {
                        val left = (nutrient.goal - nutrient.consumed).coerceAtLeast(0.0)
                        "${format(left)} ${nutrient.unit} left"
                    } else {
                        "${format(nutrient.consumed)} ${nutrient.unit}"
                    },
                )
            }
        }
    }
}

@Composable
private fun NutrientRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        QlaIcon(WearIcon.Restaurant, tint = MoveColor, size = 16.dp)
        Spacer(modifier = Modifier.width(8.dp))
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
                color = if (value == PLACEHOLDER) {
                    MaterialTheme.colorScheme.onSurfaceVariant
                } else {
                    MaterialTheme.colorScheme.onSurface
                },
            )
        }
    }
}

/** Weight and water share a screen shape: a number, two steppers, and a save. */
@Composable
fun WearMeasurementScreen(kind: MeasurementKind, listState: ScalingLazyListState) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val writeState by WearRequests.state.collectAsState()
    val knownWeight by WearState.weight.collectAsState()
    val weightUnit by WearState.weightUnit.collectAsState()

    // Opens on what the phone last recorded, so the first press is an
    // adjustment rather than a climb from a number nobody chose. Falls back to
    // the catalogue default only when the phone has never said.
    val unit = if (kind == MeasurementKind.Weight) weightUnit else kind.unit
    var amount by remember(knownWeight) {
        mutableStateOf(
            if (kind == MeasurementKind.Weight) knownWeight ?: kind.initial
            else kind.initial
        )
    }

    LaunchedEffect(kind) { WearRequests.clear() }

    ScreenColumn(listState) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                QlaIcon(kind.glyph, tint = kind.color, size = 16.dp)
                Spacer(modifier = Modifier.width(6.dp))
                Text(text = kind.title, style = MaterialTheme.typography.titleMedium)
            }
        }
        item {
            Text(
                text = "${format(amount)} $unit",
                style = MaterialTheme.typography.displaySmall,
            )
        }
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                // Tonal, not accent: the screen has one action, and it is
                // the save below. Steppers that shout as loudly as it left
                // three equal blue pills and nothing to aim for.
                FilledTonalButton(onClick = {
                    amount = (amount - kind.step).coerceAtLeast(kind.minimum)
                }) { Text("−") }
                FilledTonalButton(onClick = { amount += kind.step }) { Text("+") }
            }
        }
        item {
            Button(
                modifier = Modifier.fillMaxWidth(),
                enabled = writeState != WearWriteState.Saving,
                onClick = {
                    scope.launch {
                        WearRequests.saveMeasurement(context, kind.key, amount, unit)
                    }
                },
                icon = { QlaIcon(WearIcon.Scale, size = 16.dp) },
                label = {
                    Text(
                        when (writeState) {
                            WearWriteState.Saving -> "Saving…"
                            WearWriteState.Saved -> "Saved"
                            else -> "Add entry"
                        }
                    )
                },
            )
        }
        item {
            Caption(
                when (writeState) {
                    // Names the phone, because that is where the value went and
                    // where the person has to look if it did not arrive.
                    WearWriteState.Failed ->
                        "Could not save. Open qla.fit on your phone and try again."

                    else -> "Saves to qla.fit on your phone."
                }
            )
        }
    }
}

enum class MeasurementKind(
    val key: String,
    val title: String,
    val unit: String,
    val initial: Double,
    val step: Double,
    val minimum: Double,
    val glyph: Char,
    val color: Color,
) {
    Weight("weight", "Weight", "kg", 75.0, 0.1, 20.0, WearIcon.Scale, ExerciseColor),
    Water("water", "Water", "ml", 250.0, 50.0, 50.0, WearIcon.WaterFilled, StepsColor),
}

@Composable
private fun ScreenColumn(
    listState: ScalingLazyListState,
    content: ScalingLazyListScope.() -> Unit,
) {
    ScalingLazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
        contentPadding = roundContentPadding(),
        content = content,
    )
}

@Composable
internal fun ScreenTitle(text: String) {
    Column {
        Spacer(modifier = Modifier.height(8.dp))
        Text(text = text, style = MaterialTheme.typography.titleMedium)
    }
}

@Composable
private fun Caption(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        textAlign = TextAlign.Center,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(vertical = 6.dp),
    )
}

/** What a figure reads as before the phone has said anything. */
private const val PLACEHOLDER = "—"

/** A snapshot from before today is worth showing, but only if it says so. */
private fun isStale(updatedAt: Long): Boolean =
    updatedAt > 0 && System.currentTimeMillis() - updatedAt > 6 * 60 * 60 * 1000

/**
 * Whole numbers stay whole; anything else keeps one decimal.
 *
 * Formatted against [Locale.US] rather than the watch's, because these are
 * figures beside hand-written units like "kcal" and "km" — a decimal comma in
 * that company reads as a thousands separator.
 */
internal fun format(value: Double): String =
    if (value % 1.0 == 0.0) value.roundToInt().toString()
    else String.format(Locale.US, "%.1f", value)

/**
 * Room for the bezel and the clock.
 *
 * A round screen cuts the corners off every row, so the first line ran under
 * the time at the top and the caption lost a word at each side. The side inset
 * is generous on purpose: text near the top and bottom of a circle has far
 * less width than text across its middle.
 */
@Composable
internal fun roundContentPadding() = androidx.compose.foundation.layout.PaddingValues(
    start = 20.dp,
    end = 20.dp,
    top = 32.dp,
    bottom = 32.dp,
)
