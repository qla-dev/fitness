package fitness.qla.dev.wear

import android.content.Context
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListScope
import androidx.wear.compose.foundation.lazy.ScalingLazyListState
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.ButtonDefaults
import androidx.wear.compose.material3.CircularProgressIndicator
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ProgressIndicatorDefaults
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID
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

/** SwiftUI's `.orange` and `.blue`, which the Apple Watch tints Food and Water with. */
private val FoodColor = Color(0xFFFF9F0A)
private val WaterColor = Color(0xFF0A84FF)

/**
 * The tinted card every dashboard section sits on, copied from
 * `WatchDashboardView.swift`: the section's colour at low alpha under a
 * 14 dp rounded rectangle, so each figure reads as its own tile rather than
 * a line in a list.
 */
private val CardShape = RoundedCornerShape(14.dp)

private fun Modifier.tintedCard(color: Color, alpha: Float, padding: Dp): Modifier =
    fillMaxWidth().clip(CardShape).background(color.copy(alpha = alpha)).padding(padding)

/** One card under the rings, known before any data arrives. */
private data class DashboardCard(
    val title: String,
    /** Which phone metric fills it, by its label in the snapshot. */
    val metric: String,
    val glyph: Char,
    val color: Color,
    /** Steps and distance are totals; the others read against their goal. */
    val showGoal: Boolean,
)

private val DASHBOARD_CARDS = listOf(
    DashboardCard("Active calories", "Move", WearIcon.Flame, MoveColor, showGoal = false),
    DashboardCard("Steps", "Steps", WearIcon.Footsteps, StepsColor, showGoal = false),
    DashboardCard("Distance", "Distance", WearIcon.Navigate, StepsColor, showGoal = false),
    DashboardCard("Food", "Calories", WearIcon.Restaurant, FoodColor, showGoal = true),
    DashboardCard("Water", "Water", WearIcon.WaterFilled, WaterColor, showGoal = true),
)

@Composable
fun WearDashboardScreen(listState: ScalingLazyListState) {
    val metrics by WearState.dashboard.collectAsState()
    val updatedAt by WearState.updatedAt.collectAsState()
    val synced = metrics.isNotEmpty()
    val byLabel = metrics.associateBy { it.label }

    ScreenColumn(listState) {
        item { ScreenTitle("Today") }
        if (!synced) {
            item { Caption("Waiting for your phone. Open qla.fit to fill this in.") }
        } else if (isStale(updatedAt)) {
            item { Caption("Showing the last synced day. Open the phone dashboard to update.") }
        }
        item {
            RingsCard(
                move = byLabel["Move"],
                exercise = byLabel["Exercise"],
                steps = byLabel["Steps"],
            )
        }
        items(DASHBOARD_CARDS, key = { it.title }) { card ->
            MetricCard(card, byLabel[card.metric])
        }
        if (synced) item { LastSynced(updatedAt) }
        item { ErrorNote() }
        item { Caption("Swipe right for nutrition, left for activities") }
    }
}

/**
 * The rings beside their three totals, on one orange-tinted card — the Apple
 * Watch's top tile.
 *
 * Concentric and in the phone's order — Move outermost, then Exercise, then
 * Steps — so the glance is the same one the phone's card trains.
 */
@Composable
private fun RingsCard(move: WearMetric?, exercise: WearMetric?, steps: WearMetric?) {
    Row(
        modifier = Modifier.tintedCard(FoodColor, alpha = 0.16f, padding = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(64.dp), contentAlignment = Alignment.Center) {
            Ring(move?.fraction ?: 0f, MoveColor, 64.dp)
            Ring(exercise?.fraction ?: 0f, ExerciseColor, 46.dp)
            Ring(steps?.fraction ?: 0f, StepsColor, 28.dp)
        }
        Spacer(modifier = Modifier.width(8.dp))
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            RingTotal("Move", move, MoveColor)
            RingTotal("Exercise", exercise, ExerciseColor)
            RingTotal("Steps", steps, StepsColor)
        }
    }
}

@Composable
private fun Ring(fraction: Float, color: Color, size: Dp) {
    CircularProgressIndicator(
        progress = { fraction },
        modifier = Modifier.size(size),
        colors = ProgressIndicatorDefaults.colors(
            indicatorColor = color,
            // The unfilled part stays visible so an empty ring still reads as
            // a ring rather than as a missing element.
            trackColor = color.copy(alpha = 0.2f),
        ),
        strokeWidth = 6.dp,
    )
}

/** A ring's label over "value/goal unit", both in the ring's colour. */
@Composable
private fun RingTotal(label: String, metric: WearMetric?, color: Color) {
    Column {
        Text(text = label, color = color, fontSize = 10.sp, maxLines = 1)
        Text(
            text = metric?.let { value ->
                buildString {
                    append(format(value.value))
                    value.goal?.let { append('/').append(format(it)) }
                    if (value.unit.isNotEmpty()) append(' ').append(value.unit)
                }
            } ?: PLACEHOLDER,
            color = color,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** An icon and label over one large figure, on a card in the metric's colour. */
@Composable
private fun MetricCard(card: DashboardCard, metric: WearMetric?) {
    Column(modifier = Modifier.tintedCard(card.color, alpha = 0.15f, padding = 10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            QlaIcon(card.glyph, tint = card.color, size = 12.dp)
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = card.title,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
            )
        }
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = metric?.let { value ->
                buildString {
                    append(format(value.value))
                    if (card.showGoal) value.goal?.let { append(" / ").append(format(it)) }
                    if (value.unit.isNotEmpty()) append(' ').append(value.unit)
                }
            } ?: PLACEHOLDER,
            color = if (metric == null) MaterialTheme.colorScheme.onSurfaceVariant else card.color,
            fontSize = 22.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * The day's macros — `WatchNutritionView`: the calories as one bar against
 * their goal, then a ring per macro in the phone's own colour for it, two to a
 * row. Tapping a ring edits that macro's goal, which the phone saves.
 */
@Composable
fun WearNutritionScreen(listState: ScalingLazyListState) {
    val nutrients by WearState.nutrients.collectAsState()
    val metrics by WearState.dashboard.collectAsState()
    val updatedAt by WearState.updatedAt.collectAsState()
    var editingKey by remember { mutableStateOf<String?>(null) }
    val editing = nutrients.firstOrNull { it.key == editingKey }

    if (editing != null) {
        NutrientGoalEditor(editing, listState, onClose = { editingKey = null })
        return
    }

    val calories = metrics.firstOrNull { it.label == "Calories" }

    ScreenColumn(listState) {
        item { ScreenTitle("Nutrition") }
        if (nutrients.isEmpty()) {
            item { Caption("Waiting for your phone. Open qla.fit to fill this in.") }
        } else {
            item { CalorieMeter(eaten = calories?.value ?: 0.0, goal = calories?.goal ?: 0.0) }
            items(nutrients.chunked(2), key = { pair -> pair.first().key }) { pair ->
                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    pair.forEach { nutrient ->
                        NutrientRing(nutrient, Modifier.weight(1f)) { editingKey = nutrient.key }
                    }
                    if (pair.size == 1) Spacer(modifier = Modifier.weight(1f))
                }
            }
            item { LastSynced(updatedAt) }
        }
    }
}

/**
 * Eaten against the goal as one straight line. Past the goal the bar stays
 * full and the right-hand figure becomes how far over it went.
 */
@Composable
private fun CalorieMeter(eaten: Double, goal: Double) {
    val color = SwiftColor.Blue
    val secondary = MaterialTheme.colorScheme.onSurfaceVariant
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.fillMaxWidth()) {
            Text(
                text = buildAnnotatedString {
                    withStyle(SpanStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold)) { append(format(eaten.roundToInt().toDouble())) }
                    if (goal > 0) {
                        withStyle(SpanStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = secondary)) {
                            append(" / ")
                            append(format(goal.roundToInt().toDouble()))
                        }
                    }
                    withStyle(SpanStyle(fontSize = 10.sp, color = secondary)) { append(" kcal") }
                },
                maxLines = 1,
                modifier = Modifier.weight(1f),
            )
            if (goal > 0) {
                Text(
                    text = if (eaten > goal) "${format((eaten - goal).roundToInt().toDouble())} over"
                    else "${(eaten / goal * 100).roundToInt()}%",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = color,
                    maxLines = 1,
                )
            }
        }
        Spacer(modifier = Modifier.height(6.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(CapsuleShape)
                .background(color.copy(alpha = 0.18f)),
        ) {
            val fraction = if (goal > 0) (eaten / goal).coerceIn(0.0, 1.0).toFloat() else 0f
            if (fraction > 0f) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(fraction)
                        .height(6.dp)
                        .clip(CapsuleShape)
                        .background(color),
                )
            }
        }
    }
}

@Composable
private fun NutrientRing(nutrient: WearNutrient, modifier: Modifier, onTap: () -> Unit) {
    val color = nutrient.tint
    val secondary = MaterialTheme.colorScheme.onSurfaceVariant
    Column(
        modifier = modifier.clickable(onClick = onTap),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        QlaIcon(nutrientGlyph(nutrient.key), tint = color, size = 14.dp)
        Spacer(modifier = Modifier.height(4.dp))
        Box(modifier = Modifier.size(58.dp), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(
                progress = {
                    if (nutrient.goal > 0) (nutrient.consumed / nutrient.goal).coerceIn(0.0, 1.0).toFloat() else 0f
                },
                modifier = Modifier.size(58.dp),
                colors = ProgressIndicatorDefaults.colors(
                    indicatorColor = color,
                    trackColor = color.copy(alpha = 0.18f),
                ),
                strokeWidth = 5.dp,
            )
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(format(nutrient.consumed), fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                Text(nutrient.unit, fontSize = 9.sp, color = secondary, maxLines = 1)
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = nutrient.label,
            fontSize = 10.sp,
            color = color,
            textAlign = TextAlign.Center,
            maxLines = 2,
            modifier = Modifier.height(26.dp),
        )
        if (nutrient.goal > 0) {
            Text(
                "${format((nutrient.goal - nutrient.consumed).coerceAtLeast(0.0))} ${nutrient.unit} left",
                fontSize = 10.sp,
                color = secondary,
                maxLines = 1,
            )
            Text("Goal: ${format(nutrient.goal)} ${nutrient.unit}", fontSize = 9.sp, color = secondary, maxLines = 1)
        } else {
            Text("Add Goal", fontSize = 10.sp, color = color, maxLines = 1)
            Spacer(modifier = Modifier.height(12.dp))
        }
    }
}

/** One macro's goal, raised or lowered by its step and saved on the phone. */
@Composable
private fun NutrientGoalEditor(nutrient: WearNutrient, listState: ScalingLazyListState, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current
    val step = nutrient.goalStep
    val maximum = nutrient.goalMaximum ?: Double.MAX_VALUE
    var value by remember(nutrient.key) { mutableStateOf(nutrient.goal.coerceAtLeast(step)) }
    var saving by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }

    LaunchedEffect(nutrient.key) { listState.scrollToItem(1) }

    ScreenColumn(listState) {
        item { BackLink("Nutrition", onClose) }
        item { Text(nutrient.label, style = MaterialTheme.typography.titleMedium, color = nutrient.tint) }
        item {
            StepperRow(
                value = "${format(value)} ${nutrient.unit}",
                color = nutrient.tint,
                enabled = !saving,
                canDecrease = value - step >= step,
                canIncrease = value + step <= maximum,
                onDecrease = {
                    value = (value - step).coerceAtLeast(step)
                    haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
                },
                onIncrease = {
                    value = (value + step).coerceAtMost(maximum)
                    haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
                },
            )
        }
        item { Caption("New goals apply from today onward.") }
        if (failed) {
            item { Caption("Could not save. Open qla.fit on your phone and try again.", color = SwiftColor.Red) }
        }
        item {
            Button(
                modifier = Modifier.fillMaxWidth(),
                enabled = !saving,
                onClick = {
                    saving = true
                    failed = false
                    scope.launch {
                        val success = WearRequests.saveNutrientGoal(context, nutrient.key, value)
                        saving = false
                        if (success) {
                            haptics.performHapticFeedback(HapticFeedbackType.Confirm)
                            onClose()
                        } else {
                            failed = true
                        }
                    }
                },
                label = { Text(if (saving) "Saving…" else "Save Goal") },
            )
        }
    }
}

/** The macro's ring colour, from the phone's ARGB with full opacity. */
private val WearNutrient.tint: Color
    get() = Color((0xFF000000L or (color and 0xFFFFFFL)).toInt())

/** The nearest Ionicon to the SF Symbol the Apple Watch draws for each macro. */
private fun nutrientGlyph(key: String): Char = when (key) {
    "protein" -> WearIcon.Fish
    "carbs" -> WearIcon.Nutrition
    "dietary_fiber" -> WearIcon.Leaf
    "sugars" -> WearIcon.Cube
    "fat", "saturated_fat", "monounsaturated_fat", "polyunsaturated_fat", "trans_fat" -> WearIcon.WaterFilled
    "cholesterol" -> WearIcon.Heart
    "calcium" -> WearIcon.Cafe
    "vitamin_a", "vitamin_c" -> WearIcon.Sunny
    else -> WearIcon.Ellipse
}

/**
 * Weight and water — `WatchMeasurementView`: what the phone last recorded, and
 * an entry that opens an editor. The editor keeps its draft in the phone's
 * storage units (kg, ml) and remembers an unconfirmed entry, so a reply lost
 * between wrist and phone is retried as the SAME entry rather than adding the
 * water twice.
 */
@Composable
fun WearMeasurementScreen(kind: MeasurementKind, listState: ScalingLazyListState) {
    val knownWeight by WearState.weight.collectAsState()
    val weightUnit by WearState.weightUnit.collectAsState()
    val metrics by WearState.dashboard.collectAsState()
    val updatedAt by WearState.updatedAt.collectAsState()
    var editing by remember { mutableStateOf(false) }
    val pounds = weightUnit == "lbs"

    if (editing) {
        MeasurementEditor(kind, pounds, knownWeight, listState, onClose = { editing = false })
        return
    }

    val current = when (kind) {
        MeasurementKind.Water ->
            "${format((metrics.firstOrNull { it.label == "Water" }?.value ?: 0.0).roundToInt().toDouble())} ml"
        MeasurementKind.Weight -> knownWeight?.let {
            "${formatOneDecimal(if (pounds) it * KG_TO_LB else it)} ${if (pounds) "lb" else "kg"}"
        } ?: PLACEHOLDER
    }

    ScreenColumn(listState) {
        item { QlaIcon(kind.glyph, tint = kind.color, size = 40.dp) }
        item { Text(kind.title, style = MaterialTheme.typography.titleMedium) }
        item { Text(current, style = MaterialTheme.typography.titleLarge) }
        if (updatedAt > 0) item { LastSynced(updatedAt) }
        item {
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = { editing = true },
                colors = ButtonDefaults.buttonColors(containerColor = kind.color, contentColor = Color.Black),
                label = { Text("Add entry") },
            )
        }
        item { Caption("Saves to qla.fit on your phone.") }
    }
}

@Composable
private fun MeasurementEditor(
    kind: MeasurementKind,
    pounds: Boolean,
    knownWeight: Double?,
    listState: ScalingLazyListState,
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current
    val stored = remember(kind) { PendingMeasurements.read(context, kind.key) }
    var pending by remember(kind) { mutableStateOf(stored) }
    var value by remember(kind) {
        mutableStateOf(
            stored?.value ?: when (kind) {
                MeasurementKind.Water -> 250.0
                MeasurementKind.Weight -> (knownWeight ?: 70.0).coerceIn(kind.minimum, kind.maximum)
            }
        )
    }
    var unconfirmed by remember(kind) { mutableStateOf(stored != null) }
    var saving by remember { mutableStateOf(false) }
    val locked = saving || pending != null
    val shown = if (kind == MeasurementKind.Weight && pounds) value * KG_TO_LB else value
    val unit = when (kind) {
        MeasurementKind.Water -> "ml"
        MeasurementKind.Weight -> if (pounds) "lb" else "kg"
    }

    LaunchedEffect(kind) { listState.scrollToItem(1) }

    fun adjust(delta: Double) {
        if (locked || value + delta < kind.minimum || value + delta > kind.maximum) return
        value += delta
        haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
    }

    ScreenColumn(listState) {
        item { BackLink(kind.title, onClose) }
        item {
            StepperRow(
                value = if (kind == MeasurementKind.Water) format(shown.roundToInt().toDouble()) else formatOneDecimal(shown),
                unit = unit,
                color = kind.color,
                enabled = !locked,
                canDecrease = value - kind.step >= kind.minimum,
                canIncrease = value + kind.step <= kind.maximum,
                onDecrease = { adjust(-kind.step) },
                onIncrease = { adjust(kind.step) },
            )
        }
        if (unconfirmed) {
            item { Caption("Open qla.fit on your phone, then tap Retry to confirm this entry.") }
        }
        item {
            Button(
                modifier = Modifier.fillMaxWidth(),
                enabled = !saving,
                onClick = {
                    val entry = pending ?: PendingMeasurement(
                        entryId = UUID.randomUUID().toString(),
                        value = value,
                        date = LocalDate.now().toString(),
                    ).also {
                        pending = it
                        PendingMeasurements.write(context, kind.key, it)
                    }
                    saving = true
                    scope.launch {
                        val success = WearRequests.saveMeasurement(context, entry.entryId, kind.key, entry.value, entry.date)
                        saving = false
                        if (success) {
                            PendingMeasurements.clear(context, kind.key)
                            pending = null
                            WearState.applySavedMeasurement(kind.key, entry.value)
                            haptics.performHapticFeedback(HapticFeedbackType.Confirm)
                            onClose()
                        } else {
                            unconfirmed = true
                        }
                    }
                },
                label = { Text(if (saving) "Saving…" else if (unconfirmed) "Retry" else "Save") },
            )
        }
    }
}

/** − value + with round tinted buttons, the Apple Watch's editor row. */
@Composable
private fun StepperRow(
    value: String,
    color: Color,
    enabled: Boolean,
    canDecrease: Boolean,
    canIncrease: Boolean,
    onDecrease: () -> Unit,
    onIncrease: () -> Unit,
    unit: String? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RoundStepButton(WearIcon.Remove, color, enabled && canDecrease, onDecrease)
        Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, style = MaterialTheme.typography.titleLarge, maxLines = 1)
            unit?.let { Text(it, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        RoundStepButton(WearIcon.Add, color, enabled && canIncrease, onIncrease)
    }
}

@Composable
private fun RoundStepButton(glyph: Char, color: Color, enabled: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(color.copy(alpha = if (enabled) 0.22f else 0.08f))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        QlaIcon(glyph, tint = if (enabled) color else color.copy(alpha = 0.4f), size = 18.dp)
    }
}

@Composable
private fun BackLink(title: String, onBack: () -> Unit) {
    Text(
        text = "‹ $title",
        fontSize = 11.sp,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.clickable(onClick = onBack).padding(vertical = 4.dp),
    )
}

/** An entry sent to the phone and not yet confirmed, kept across app restarts. */
private data class PendingMeasurement(val entryId: String, val value: Double, val date: String)

/** `UserDefaults` "pendingMeasurement-<kind>" on the Apple Watch. */
private object PendingMeasurements {
    private const val PREFS = "qla_wear"

    fun read(context: Context, kind: String): PendingMeasurement? {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString("pendingMeasurement-$kind", null) ?: return null
        return runCatching {
            val json = JSONObject(raw)
            PendingMeasurement(json.getString("entryId"), json.getDouble("value"), json.getString("date"))
        }.getOrNull()
    }

    fun write(context: Context, kind: String, entry: PendingMeasurement) {
        val json = JSONObject().put("entryId", entry.entryId).put("value", entry.value).put("date", entry.date)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("pendingMeasurement-$kind", json.toString()).apply()
    }

    fun clear(context: Context, kind: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .remove("pendingMeasurement-$kind").apply()
    }
}

private const val KG_TO_LB = 2.2046226218

private fun formatOneDecimal(value: Double): String = String.format(Locale.US, "%.1f", value)

/**
 * Steps and bounds in storage units, as `WatchMeasurementEditor` has them: a
 * glass of water is 250 ml, and a weight tap is exactly 2 kg even when the
 * watch displays the equivalent in pounds.
 */
enum class MeasurementKind(
    val key: String,
    val title: String,
    val step: Double,
    val minimum: Double,
    val maximum: Double,
    val glyph: Char,
    val color: Color,
) {
    Weight("weight", "Weight", 2.0, 1.0, 299.9, WearIcon.Scale, SwiftColor.Green),
    Water("water", "Water", 250.0, 25.0, 2000.0, WearIcon.WaterFilled, SwiftColor.Blue),
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
private fun Caption(text: String, color: Color = MaterialTheme.colorScheme.onSurfaceVariant) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        textAlign = TextAlign.Center,
        color = color,
        modifier = Modifier.padding(vertical = 6.dp),
    )
}

/** "Last synced from phone" over when, as every Apple Watch page ends. */
@Composable
private fun LastSynced(updatedAt: Long) {
    if (updatedAt <= 0) return
    val formatted = remember(updatedAt) {
        DateTimeFormatter.ofPattern("MMM d, HH:mm", Locale.getDefault())
            .format(Instant.ofEpochMilli(updatedAt).atZone(ZoneId.systemDefault()))
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(vertical = 4.dp)) {
        Text("Last synced from phone", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(formatted, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/**
 * The last failure, said on the wrist — `ErrorNote` on the Apple Watch. A
 * failure to start on the watch is one the phone cannot show.
 */
@Composable
internal fun ErrorNote() {
    val error by WearState.lastError.collectAsState()
    error?.let {
        Text(
            text = it,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        )
    }
}

private val CapsuleShape = RoundedCornerShape(50)

/** What a figure reads as before the phone has said anything. */
internal const val PLACEHOLDER = "—"

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
