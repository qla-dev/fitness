package fitness.qla.dev.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.AppScaffold
import androidx.wear.compose.material3.ScreenScaffold

/**
 * The watch app's entry point.
 *
 * Pages in the order the Apple Watch has them, so the two watches read the
 * same: the two measurements you log most, then what you ate, then the day,
 * then the ways to start something.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { QlaWearTheme { WearApp() } }
    }
}

/**
 * Where a page's list sits when you arrive on it.
 *
 * A ScalingLazyColumn centres the index it is given, so anchoring on the first
 * row left the top third of a round screen empty and pushed the action off the
 * bottom. Centring the third row fits a short screen — heading, reading,
 * controls, action — in one view without scrolling.
 *
 * The dashboard is the exception, and takes its own: its second row is the
 * ring cluster, and centring the row after it pushed the rings up under the
 * clock, where the watch face clipped their top arc.
 */
private enum class Page(val startIndex: Int) {
    Weight(2),
    Water(2),
    Nutrition(2),
    Dashboard(1),
    Sports(2),
    Programs(2),
}

@Composable
private fun WearApp() {
    val context = LocalContext.current

    // A session takes the whole watch while it runs: mid-effort there is
    // nothing else to look at, and a pager under a running workout is a way to
    // swipe away from the Finish button by accident.
    var recording by remember { mutableStateOf<WearSport?>(null) }

    recording?.let { sport ->
        WearActiveScreen(sport = sport, onFinished = { recording = null })
        return
    }

    val pages = Page.entries
    // Opens on the dashboard, with the entry screens a swipe to the left and
    // the ways to start something a swipe to the right.
    val pagerState = rememberPagerState(
        initialPage = pages.indexOf(Page.Dashboard),
        pageCount = { pages.size },
    )

    // One scroll position per page, held here rather than inside each screen:
    // the pager keeps neighbouring pages composed, so a state remembered in the
    // screen survives the swipe and you land back halfway down a list you left
    // days ago. Owning them here is what lets arriving on a page put it back to
    // the top.
    val listStates = pages.map { rememberScalingLazyListState(it.startIndex) }

    LaunchedEffect(Unit) {
        WearState.setPhoneReachable(WearLink.isPhoneReachable(context))
    }

    // `settledPage` rather than `currentPage`: resetting mid-swipe would drag
    // the list under the finger while the page is still moving.
    LaunchedEffect(pagerState.settledPage) {
        val settled = pagerState.settledPage
        listStates[settled].scrollToItem(pages[settled].startIndex)
    }

    AppScaffold {
        HorizontalPager(state = pagerState) { index ->
            val listState = listStates[index]
            ScreenScaffold(scrollState = listState) {
                when (pages[index]) {
                    Page.Weight -> WearMeasurementScreen(MeasurementKind.Weight, listState)
                    Page.Water -> WearMeasurementScreen(MeasurementKind.Water, listState)
                    Page.Nutrition -> WearNutritionScreen(listState)
                    Page.Dashboard -> WearDashboardScreen(listState)
                    Page.Sports -> WearSportsScreen(
                        listState = listState,
                        onStarted = { sport -> recording = sport },
                    )
                    Page.Programs -> WearProgramsScreen(listState)
                }
            }
        }
    }
}
