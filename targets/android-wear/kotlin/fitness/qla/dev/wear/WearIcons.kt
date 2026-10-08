package fitness.qla.dev.wear

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

/**
 * The phone's icons, on the wrist.
 *
 * The Android app draws every icon with Ionicons through `src/components/
 * Icon.tsx`, so the watch ships the same font and the same glyphs rather than
 * a second icon set. A sport is then the same picture in both places, and a
 * rebrand that changes one changes the other.
 *
 * Material's icon library was the alternative and was rejected twice over: the
 * core set has no sports at all, and the extended set is tens of megabytes
 * that this module cannot shrink away, because the watch build runs with
 * `minifyEnabled false`. One 380 KB font covers every glyph here and more.
 *
 * Codepoints are taken from the same glyphmap the app resolves names through
 * (`@expo/vector-icons/.../glyphmaps/Ionicons.json`). They are written as
 * literals because the watch cannot read that JSON, the same hand-copying the
 * message paths already live with.
 */
object WearIcon {
    // Sports, matching the `ion` side of ICON_MAP for each sport's icon.
    const val Walk = '' // walk
    const val WalkOutline = '' // walk-outline
    const val Bicycle = '' // bicycle-outline
    const val Water = '' // water-outline
    const val Barbell = '' // barbell-outline
    const val Body = '' // body-outline
    const val Tennis = '' // tennisball-outline
    const val Basketball = '' // basketball-outline
    const val Football = '' // football-outline
    const val Fitness = '' // fitness-outline

    // Dashboard and entry screens.
    const val Flame = '' // flame
    const val Footsteps = '' // footsteps
    const val Restaurant = '' // restaurant
    const val WaterFilled = '' // water
    const val Time = '' // time-outline
    const val Navigate = '' // navigate
    const val Scale = '' // scale-outline

    // Macros, the nearest Ionicons to the SF Symbols the Apple Watch uses.
    const val Fish = '' // fish
    const val Nutrition = '' // nutrition
    const val Leaf = '' // leaf
    const val Cube = '' // cube
    const val Heart = '' // heart
    const val Cafe = '' // cafe
    const val Sunny = '' // sunny
    const val Ellipse = '' // ellipse

    // Controls.
    const val Add = '' // add
    const val Remove = '' // remove
    const val Stop = '' // stop
    const val Pause = '' // pause
    const val Play = '' // play
    const val PhonePortrait = '' // phone-portrait-outline
}

private val Ionicons = FontFamily(Font(R.font.ionicons))

/**
 * A glyph sized and tinted like an icon rather than like text.
 *
 * Boxed at an explicit size so a row's height does not move when one icon's
 * glyph happens to have taller metrics than its neighbour's — on a list of
 * sports that showed up as rows of visibly different heights.
 */
@Composable
fun QlaIcon(
    glyph: Char,
    modifier: Modifier = Modifier,
    size: Dp = 18.dp,
    tint: Color = MaterialTheme.colorScheme.onSurfaceVariant,
) {
    Box(modifier = modifier.size(size), contentAlignment = Alignment.Center) {
        Text(
            text = glyph.toString(),
            fontFamily = Ionicons,
            fontSize = (size.value * 0.95f).sp,
            color = tint,
        )
    }
}
