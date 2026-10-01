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
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * The screens the Apple Watch already has, in the same order and saying the
 * same things — `targets/watch/` is the specification, so a person with one
 * watch on each wrist sees one app.
 *
 * Every screen that cannot answer says so rather than showing zeroes: a watch
 * that reads "0 kcal" when it simply has not heard from the phone is lying
 * about the day.
 */

@Composable
fun WearDashboardScreen(listState: ScalingLazyListState) {
    val metrics by WearState.dashboard.collectAsState()
    val updatedAt by WearState.updatedAt.collectAsState()

    if (metrics.isEmpty()) {
        EmptyScreen("Open the phone dashboard to sync your daily activity.")
        return
    }

    ScreenColumn(listState) {
        item { ScreenTitle("Today") }
        if (isStale(updatedAt)) {
            item { Caption("Showing the last synced day. Open the phone dashboard to update.") }
        }
        items(metrics) { metric -> MetricRow(metric) }
    }
}

@Composable
private fun MetricRow(metric: WearMetric) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        metric.fraction?.let { fraction ->
            Box(modifier = Modifier.size(28.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(progress = { fraction })
            }
            Spacer(modifier = Modifier.size(8.dp))
        }
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(text = metric.label, style = MaterialTheme.typography.labelSmall)
            Text(
                text = buildString {
                    append(format(metric.value))
                    metric.goal?.let { append(" / ").append(format(it)) }
                    if (metric.unit.isNotEmpty()) append(' ').append(metric.unit)
                },
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
fun WearNutritionScreen(listState: ScalingLazyListState) {
    val nutrients by WearState.nutrients.collectAsState()

    if (nutrients.isEmpty()) {
        EmptyScreen("Open the phone dashboard to sync your daily activity.")
        return
    }

    ScreenColumn(listState) {
        item { ScreenTitle("Nutrition") }
        items(nutrients) { nutrient ->
            Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Text(text = nutrient.label, style = MaterialTheme.typography.labelSmall)
                Text(
                    // "left" rather than "eaten": on a wrist the useful number
                    // is what is still allowed, which is what the phone card
                    // shows too. With no goal there is nothing to subtract
                    // from, so the total stands on its own.
                    text = if (nutrient.goal > 0) {
                        val left = (nutrient.goal - nutrient.consumed).coerceAtLeast(0.0)
                        "${format(left)} ${nutrient.unit} left"
                    } else {
                        "${format(nutrient.consumed)} ${nutrient.unit}"
                    },
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

/** Weight and water share a screen shape: a number, two steppers, and a save. */
@Composable
fun WearMeasurementScreen(kind: MeasurementKind, listState: ScalingLazyListState) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val writeState by WearRequests.state.collectAsState()
    var amount by remember { mutableStateOf(kind.initial) }

    LaunchedEffect(kind) { WearRequests.clear() }

    ScreenColumn(listState) {
        item { ScreenTitle(kind.title) }
        item {
            Text(
                text = "${format(amount)} ${kind.unit}",
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
                        WearRequests.saveMeasurement(context, kind.key, amount, kind.unit)
                    }
                },
            ) {
                Text(
                    when (writeState) {
                        WearWriteState.Saving -> "Saving…"
                        WearWriteState.Saved -> "Saved"
                        else -> "Add entry"
                    }
                )
            }
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
) {
    Weight("weight", "Weight", "kg", 75.0, 0.1, 20.0),
    Water("water", "Water", "ml", 250.0, 50.0, 50.0),
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
private fun ScreenTitle(text: String) {
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
        modifier = Modifier.padding(vertical = 6.dp),
    )
}

@Composable
private fun EmptyScreen(message: String) {
    Box(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodySmall,
            textAlign = TextAlign.Center,
        )
    }
}

/** A snapshot from before today is worth showing, but only if it says so. */
private fun isStale(updatedAt: Long): Boolean =
    updatedAt > 0 && System.currentTimeMillis() - updatedAt > 6 * 60 * 60 * 1000

/** Whole numbers stay whole; anything else keeps one decimal. */
internal fun format(value: Double): String =
    if (value % 1.0 == 0.0) value.roundToInt().toString()
    else String.format("%.1f", value)

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
