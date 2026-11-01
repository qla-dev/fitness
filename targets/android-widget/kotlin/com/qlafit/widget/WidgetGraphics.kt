package com.qlafit.widget

import android.content.Context
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import androidx.compose.ui.graphics.Color
import androidx.glance.color.ColorProvider as DayNightColorProvider
import androidx.glance.unit.ColorProvider
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * The app's theme tokens (global.css, light and dark) for the Glance widgets.
 *
 * Text and surfaces use day/night providers, so the launcher swaps them with
 * the system appearance. The rings and arcs are bitmaps (Glance has no canvas),
 * drawn in the appearance current at render time; [WidgetGraphics] picks it.
 */
object WidgetPalette {
    val surface: ColorProvider = DayNightColorProvider(day = Color(0xFFF9FAFB), night = Color(0xFF080A0C))
    val textPrimary: ColorProvider = DayNightColorProvider(day = Color(0xFF0F1729), night = Color(0xFFE8EAEE))
    val textSecondary: ColorProvider = DayNightColorProvider(day = Color(0xFF536379), night = Color(0xFFABB0BA))
    val textMuted: ColorProvider = DayNightColorProvider(day = Color(0xFF94A3B8), night = Color(0xFF737B8C))
    val divider: ColorProvider = DayNightColorProvider(day = Color(0xFFE1E5EA), night = Color(0xFF1C1F26))
    val eaten: ColorProvider = DayNightColorProvider(day = Color(0xFF5087F7), night = Color(0xFF427CF0))
    val protein: ColorProvider = DayNightColorProvider(day = Color(0xFF7AD680), night = Color(0xFF89C88D))
    val carbs: ColorProvider = DayNightColorProvider(day = Color(0xFFAD74E7), night = Color(0xFFB388DD))
    val fat: ColorProvider = DayNightColorProvider(day = Color(0xFFF6B151), night = Color(0xFFE3AE63))
    val move: ColorProvider = DayNightColorProvider(day = Color(0xFFFF375F), night = Color(0xFFFF375F))
    val exercise: ColorProvider = DayNightColorProvider(day = Color(0xFFA8EF00), night = Color(0xFFA8EF00))
    val steps: ColorProvider = DayNightColorProvider(day = Color(0xFF00D8EB), night = Color(0xFF00D8EB))
}

/** ARGB values for the bitmaps, per appearance. */
object WidgetInk {
    val MOVE: Int = 0xFFFF375F.toInt()
    val EXERCISE: Int = 0xFFA8EF00.toInt()
    val STEPS: Int = 0xFF00D8EB.toInt()

    fun isNight(context: Context): Boolean =
        (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES

    fun track(context: Context): Int =
        if (isNight(context)) 0xFF172236.toInt() else 0xFFE5E9F1.toInt()

    fun eaten(context: Context): Int =
        if (isNight(context)) 0xFF427CF0.toInt() else 0xFF5087F7.toInt()

    fun protein(context: Context): Int =
        if (isNight(context)) 0xFF89C88D.toInt() else 0xFF7AD680.toInt()

    fun carbs(context: Context): Int =
        if (isNight(context)) 0xFFB388DD.toInt() else 0xFFAD74E7.toInt()

    fun fat(context: Context): Int =
        if (isNight(context)) 0xFFE3AE63.toInt() else 0xFFF6B151.toInt()

    /** The faint same-hue track the Activity Rings card draws under each ring. */
    fun faint(color: Int, alpha: Float = 0.18f): Int {
        val a = (alpha.coerceIn(0f, 1f) * 255).roundToInt()
        return (a shl 24) or (color and 0x00FFFFFF)
    }
}

/**
 * The app's three gauge shapes as bitmaps: a closed ring that fills clockwise
 * from twelve (ProgressRing / MacroRingGauge), the nested dome arcs of the
 * Tracker's nutrition card (ArcGauge), and the concentric Activity Rings.
 *
 * Sizes are in dp and rendered at the screen density, capped so a widget's
 * bitmaps stay well inside the RemoteViews transaction budget.
 */
object WidgetGraphics {
    private const val MAX_SCALE = 2.5f

    private fun scale(context: Context): Float =
        context.resources.displayMetrics.density.coerceIn(1f, MAX_SCALE)

    private fun strokePaint(width: Float): Paint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = width
        }

    private fun drawRing(
        canvas: Canvas,
        oval: RectF,
        stroke: Float,
        progress: Float,
        color: Int,
        trackColor: Int,
    ) {
        val paint = strokePaint(stroke)
        paint.color = trackColor
        paint.strokeCap = Paint.Cap.BUTT
        canvas.drawArc(oval, 0f, 360f, false, paint)
        val filled = progress.coerceIn(0f, 1f)
        if (filled > 0f) {
            paint.color = color
            paint.strokeCap = Paint.Cap.ROUND
            canvas.drawArc(oval, -90f, 360f * filled, false, paint)
        }
    }

    /** The top half of a ring, filling left to right over the top. */
    private fun drawDome(
        canvas: Canvas,
        oval: RectF,
        stroke: Float,
        progress: Float,
        color: Int,
        trackColor: Int,
    ) {
        val paint = strokePaint(stroke)
        paint.strokeCap = Paint.Cap.ROUND
        paint.color = trackColor
        canvas.drawArc(oval, 180f, 180f, false, paint)
        val filled = progress.coerceIn(0f, 1f)
        if (filled > 0f) {
            paint.color = color
            canvas.drawArc(oval, 180f, 180f * filled, false, paint)
        }
    }

    /** One nutrient ring, [sizeDp] square. */
    fun ring(
        context: Context,
        sizeDp: Float,
        strokeDp: Float,
        progress: Float,
        color: Int,
        trackColor: Int,
    ): Bitmap {
        val s = scale(context)
        val px = max(1, (sizeDp * s).roundToInt())
        val bitmap = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
        val stroke = strokeDp * s
        val inset = stroke / 2f
        drawRing(
            Canvas(bitmap),
            RectF(inset, inset, px - inset, px - inset),
            stroke,
            progress,
            color,
            trackColor,
        )
        return bitmap
    }

    /**
     * Eaten (outer, against the calorie goal) and burned (inner, against the
     * Move goal) as nested domes on one centre, [widthDp] wide.
     */
    fun calorieArcs(
        context: Context,
        widthDp: Float,
        strokeDp: Float,
        eatenProgress: Float,
        burnedProgress: Float,
        eatenColor: Int,
        burnedColor: Int,
        trackColor: Int,
    ): Bitmap {
        val s = scale(context)
        val width = max(1, (widthDp * s).roundToInt())
        val stroke = strokeDp * s
        val height = max(1, (width / 2f + stroke).roundToInt())
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val half = stroke / 2f
        val outer = RectF(half, half, width - half, width - half)
        drawDome(canvas, outer, stroke, eatenProgress, eatenColor, trackColor)
        val gap = stroke + max(3f * s, stroke * 0.4f)
        val inner = RectF(outer.left + gap, outer.top + gap, outer.right - gap, outer.bottom - gap)
        if (inner.width() > stroke * 2) {
            drawDome(canvas, inner, stroke, burnedProgress, burnedColor, trackColor)
        }
        return bitmap
    }

    /**
     * Move, Exercise and Steps as the Activity Rings card draws them: radii
     * 61/45/29 and 12-wide strokes on a 144 canvas, outermost first, each over
     * a faint track of its own colour.
     */
    fun activityRings(
        context: Context,
        sizeDp: Float,
        move: Float,
        exercise: Float,
        steps: Float,
    ): Bitmap {
        val s = scale(context)
        val px = max(1, (sizeDp * s).roundToInt())
        val bitmap = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val unit = px / 144f
        val stroke = 12f * unit
        val centre = px / 2f
        val rings = listOf(
            Triple(61f, move, WidgetInk.MOVE),
            Triple(45f, exercise, WidgetInk.EXERCISE),
            Triple(29f, steps, WidgetInk.STEPS),
        )
        for ((radius, progress, color) in rings) {
            val r = radius * unit
            drawRing(
                canvas,
                RectF(centre - r, centre - r, centre + r, centre + r),
                stroke,
                progress,
                color,
                WidgetInk.faint(color),
            )
        }
        return bitmap
    }
}

/** Value against goal as 0–1, or 0 without a goal. */
fun widgetRatio(value: Double, goal: Double): Float {
    if (goal <= 0.0 || !value.isFinite() || !goal.isFinite()) return 0f
    return (value / goal).coerceIn(0.0, 1.0).toFloat()
}
