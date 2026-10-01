package fitness.qla.dev.wear

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material3.ColorScheme
import androidx.wear.compose.material3.MaterialTheme

/**
 * The app's own palette, taken from the dark theme in `global.css`.
 *
 * The phone's dark theme is already true black for AMOLED, which is exactly
 * what a watch wants — an unlit pixel costs no battery — so the watch uses the
 * same values rather than a lightened variant. The blue is the same accent the
 * tab bar, the buttons and the rings use, so the wrist and the hand read as one
 * product instead of two.
 *
 * Values are the hex of the `hsl()` tokens, not a fresh guess at "roughly the
 * same blue": a second palette drifts the moment either side is retouched.
 */
private val Background = Color(0xFF000000) // --color-background
private val Surface = Color(0xFF080A0C) // --color-surface
private val Raised = Color(0xFF111318) // --color-raised
private val Border = Color(0xFF1C1F26) // --color-border
private val TextPrimary = Color(0xFFE8EAEE) // --color-text-primary
private val TextSecondary = Color(0xFFABB0BA) // --color-text-secondary
private val TextMuted = Color(0xFF737B8C) // --color-text-muted
private val Accent = Color(0xFF427CF0) // --color-accent-primary
private val AccentMuted = Color(0xFF7096E1) // --color-accent-muted
private val AccentText = Color(0xFFF0F5FF) // --color-accent-text
private val Danger = Color(0xFFE5484D)

private val QlaColorScheme = ColorScheme(
    primary = Accent,
    onPrimary = AccentText,
    // The filled surface a primary control sits on. `raised` rather than a
    // tinted blue: on black, a solid accent pill is the loudest thing on the
    // screen, and most rows here are readings rather than actions.
    primaryContainer = Raised,
    onPrimaryContainer = TextPrimary,
    secondary = AccentMuted,
    onSecondary = AccentText,
    secondaryContainer = Surface,
    onSecondaryContainer = TextPrimary,
    background = Background,
    onBackground = TextPrimary,
    surfaceContainerLow = Surface,
    surfaceContainer = Raised,
    surfaceContainerHigh = Border,
    onSurface = TextPrimary,
    onSurfaceVariant = TextSecondary,
    outline = Border,
    outlineVariant = TextMuted,
    error = Danger,
    onError = AccentText,
)

@Composable
fun QlaWearTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = QlaColorScheme, content = content)
}
