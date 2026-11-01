import SwiftUI
import UIKit
import WidgetKit

// The app's own look for the widgets: theme tokens from global.css, and the
// three shapes the app measures a day with — closed rings (Activity Rings and
// the Tracker's nutrient rings) and the dome arc on the Tracker's nutrition
// card.

private extension UIColor {
    convenience init(widgetHex hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

extension Color {
    /// One theme token, resolved per appearance the way the app's light and
    /// dark variants resolve it.
    init(lightHex: UInt32, darkHex: UInt32) {
        self.init(uiColor: UIColor { traits in
            UIColor(widgetHex: traits.userInterfaceStyle == .dark ? darkHex : lightHex)
        })
    }
}

/// The global.css tokens the widgets draw with (light, dark).
enum WidgetPalette {
    /// --color-surface: the app's card background.
    static let surface = Color(lightHex: 0xF9FAFB, darkHex: 0x080A0C)
    /// --color-text-primary / -secondary / -muted.
    static let textPrimary = Color(lightHex: 0x0F1729, darkHex: 0xE8EAEE)
    static let textSecondary = Color(lightHex: 0x536379, darkHex: 0xABB0BA)
    static let textMuted = Color(lightHex: 0x94A3B8, darkHex: 0x737B8C)
    /// --color-progress-track: the unfilled part of an arc or nutrient ring.
    static let track = Color(lightHex: 0xE5E9F1, darkHex: 0x172236)
    /// --color-border: hairline dividers.
    static let divider = Color(lightHex: 0xE1E5EA, darkHex: 0x1C1F26)
    /// --color-accent-primary: Eaten on the nutrition card, and the actions.
    static let eaten = Color(lightHex: 0x5087F7, darkHex: 0x427CF0)
    /// --color-macro-protein / -carbs / -fat.
    static let protein = Color(lightHex: 0x7AD680, darkHex: 0x89C88D)
    static let carbs = Color(lightHex: 0xAD74E7, darkHex: 0xB388DD)
    static let fat = Color(lightHex: 0xF6B151, darkHex: 0xE3AE63)
    /// ACTIVITY_RING_COLORS: the same in both appearances, as in the app.
    static let move = Color(lightHex: 0xFF375F, darkHex: 0xFF375F)
    static let exercise = Color(lightHex: 0xA8EF00, darkHex: 0xA8EF00)
    static let steps = Color(lightHex: 0x00D8EB, darkHex: 0x00D8EB)
}

func clampedProgress(_ value: Double) -> Double {
    guard value.isFinite else { return 0 }
    return min(1, max(0, value))
}

func ratio(_ value: Double, of goal: Double) -> Double {
    guard goal > 0 else { return 0 }
    return clampedProgress(value / goal)
}

/// A closed ring that fills clockwise from twelve o'clock (ProgressRing,
/// MacroRingGauge). The stroke stays inside the frame it is given.
struct WidgetRing: View {
    let progress: Double
    let color: Color
    let trackColor: Color
    let lineWidth: CGFloat

    var body: some View {
        let filled = clampedProgress(progress)
        ZStack {
            Circle()
                .stroke(trackColor, lineWidth: lineWidth)
            if filled > 0 {
                Circle()
                    .trim(from: 0, to: CGFloat(filled))
                    .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
        }
        .padding(lineWidth / 2)
    }
}

/// The top half of a ring, filling left to right over the top (ArcGauge).
/// Laid out as tall as the dome and the caps that hang below its ends.
struct WidgetArc: View {
    let size: CGFloat
    let lineWidth: CGFloat
    let progress: Double
    let color: Color
    let trackColor: Color

    static func height(size: CGFloat, lineWidth: CGFloat) -> CGFloat {
        size / 2 + lineWidth / 2
    }

    var body: some View {
        let filled = clampedProgress(progress)
        ZStack {
            // A circle's path starts at three o'clock and runs clockwise, so
            // 0.5 is nine o'clock and 0.5–1 is the top half.
            Circle()
                .trim(from: 0.5, to: 1)
                .stroke(trackColor, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
            if filled > 0 {
                Circle()
                    .trim(from: 0.5, to: CGFloat(0.5 + 0.5 * filled))
                    .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
            }
        }
        .padding(lineWidth / 2)
        .frame(width: size, height: size)
        .frame(width: size, height: Self.height(size: size, lineWidth: lineWidth), alignment: .top)
    }
}

/// Eaten and burned as the nutrition card nests them: eaten outside against
/// the calorie goal, burned inside against the Move goal, on one centre.
struct CalorieArcs: View {
    let size: CGFloat
    let lineWidth: CGFloat
    let eatenProgress: Double
    let burnedProgress: Double
    var eatenColor: Color = WidgetPalette.eaten
    var burnedColor: Color = WidgetPalette.move
    var trackColor: Color = WidgetPalette.track

    private var inset: CGFloat { lineWidth + max(3, lineWidth * 0.4) }

    var body: some View {
        ZStack(alignment: .top) {
            WidgetArc(
                size: size,
                lineWidth: lineWidth,
                progress: eatenProgress,
                color: eatenColor,
                trackColor: trackColor
            )
            WidgetArc(
                size: size - 2 * inset,
                lineWidth: lineWidth,
                progress: burnedProgress,
                color: burnedColor,
                trackColor: trackColor
            )
            .padding(.top, inset)
        }
        .frame(
            width: size,
            height: WidgetArc.height(size: size, lineWidth: lineWidth),
            alignment: .top
        )
    }
}

/// Move, Exercise and Steps as the Activity Rings card draws them: concentric,
/// outermost first, each over a faint track of its own colour. Geometry is the
/// card's 144-point drawing (radii 61/45/29, 12-point strokes) scaled to fit.
struct ActivityRings: View {
    let size: CGFloat
    let move: Double
    let exercise: Double
    let steps: Double
    var colors: [Color] = [WidgetPalette.move, WidgetPalette.exercise, WidgetPalette.steps]
    var trackOpacity: Double = 0.18
    /// Lock Screen rings sit closer together and a touch thicker.
    var strokeScale: CGFloat = 1

    var body: some View {
        let unit = size / 144
        let lineWidth = 12 * unit * strokeScale
        let values = [move, exercise, steps]
        ZStack {
            ForEach(0..<3, id: \.self) { index in
                let diameter = (2 * (61 - 16 * CGFloat(index)) + 12) * unit
                WidgetRing(
                    progress: values[index],
                    color: colors[index],
                    trackColor: colors[index].opacity(trackOpacity),
                    lineWidth: lineWidth
                )
                .frame(width: diameter, height: diameter)
            }
        }
        .frame(width: size, height: size)
    }
}

/// The app's card surface behind every Home Screen family; the Lock Screen
/// families keep the system's own background.
struct WidgetSurfaceBackground: ViewModifier {
    @Environment(\.widgetFamily) private var family

    func body(content: Content) -> some View {
        content.containerBackground(for: .widget) {
            switch family {
            case .accessoryCircular, .accessoryRectangular, .accessoryInline:
                Color.clear
            default:
                WidgetPalette.surface
            }
        }
    }
}

extension View {
    func widgetSurfaceBackground() -> some View {
        modifier(WidgetSurfaceBackground())
    }
}

/// The search/scan shortcut column on the medium widgets.
struct ActionButton: View {
    let icon: String
    let destination: URL
    let accessibilityLabel: String

    var body: some View {
        Link(destination: destination) {
            Image(systemName: icon)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(WidgetPalette.eaten)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(
                    Circle()
                        .fill(WidgetPalette.eaten.opacity(0.12))
                        .frame(width: 34, height: 34)
                )
                .contentShape(Rectangle())
        }
        .accessibilityLabel(accessibilityLabel)
    }
}

struct WidgetActionColumn: View {
    var body: some View {
        VStack(spacing: 14) {
            ActionButton(
                icon: "magnifyingglass",
                destination: URL(string: "sparkyfitnessmobile://search")!,
                accessibilityLabel: localizedWidgetString("widget.search_food")
            )
            ActionButton(
                icon: "barcode.viewfinder",
                destination: URL(string: "sparkyfitnessmobile://scan")!,
                accessibilityLabel: localizedWidgetString("widget.scan_barcode")
            )
        }
        .frame(width: 36)
        .frame(maxHeight: .infinity)
    }
}

struct WidgetVerticalDivider: View {
    var body: some View {
        Rectangle()
            .fill(WidgetPalette.divider)
            .frame(width: 1)
            .frame(maxHeight: .infinity)
            .padding(.vertical, 6)
    }
}
