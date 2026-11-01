import WidgetKit
import SwiftUI

struct CalorieSnapshot {
    let food: Double
    let burned: Double
    let goal: Double
    let remaining: Double
    let progress: Double
    /// The Move goal burned fills against; 0 when an older snapshot lacks it.
    var burnGoal: Double = 0
    let lastUpdated: Date?

    static let empty = CalorieSnapshot(food: 0, burned: 0, goal: 0, remaining: 0, progress: 0, lastUpdated: nil)

    var hasData: Bool { goal > 0 || food > 0 || burned > 0 }

    /// The inner arc. Without a Move goal it shares the calorie goal's scale,
    /// so a snapshot written before the arcs still draws something sensible.
    var burnedProgress: Double {
        if burnGoal > 0 { return ratio(burned, of: burnGoal) }
        return ratio(burned, of: goal)
    }
}

private struct CalorieSnapshotPayload: Decodable {
    let date: String?
    let food: Double?
    let burned: Double?
    let goal: Double?
    let remaining: Double?
    let progress: Double?
    let burnGoal: Double?
    let lastUpdated: Double?
}

private func loadCalorieSnapshot() -> CalorieSnapshot {
    guard
        let appGroup = appGroupIdentifier(),
        !appGroup.isEmpty,
        let defaults = UserDefaults(suiteName: appGroup),
        let data = defaults.data(forKey: "calorieSnapshot"),
        let payload = try? JSONDecoder().decode(CalorieSnapshotPayload.self, from: data),
        isToday(payload.date)
    else {
        return .empty
    }
    return snapshot(from: payload)
}

private func fallbackProgress(goal: Double, remaining: Double) -> Double {
    guard goal > 0 else { return 0 }
    return min(1, max(0, (goal - remaining) / goal))
}

private func snapshot(from payload: CalorieSnapshotPayload) -> CalorieSnapshot {
    let goal = payload.goal ?? 0
    let remaining = payload.remaining ?? 0
    return CalorieSnapshot(
        food: payload.food ?? 0,
        burned: payload.burned ?? 0,
        goal: goal,
        remaining: remaining,
        progress: clampedProgress(payload.progress ?? fallbackProgress(goal: goal, remaining: remaining)),
        burnGoal: payload.burnGoal ?? 0,
        lastUpdated: payload.lastUpdated.map { Date(timeIntervalSince1970: $0) }
    )
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let snapshot: CalorieSnapshot
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), snapshot: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        completion(SimpleEntry(date: Date(), snapshot: loadCalorieSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let now = Date()
        let entry = SimpleEntry(date: now, snapshot: loadCalorieSnapshot())
        let in15Minutes = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now
        let nextMidnight = Calendar.current.nextDate(
            after: now,
            matching: DateComponents(hour: 0, minute: 0, second: 0),
            matchingPolicy: .nextTime
        ) ?? in15Minutes
        let refreshAt = min(in15Minutes, nextMidnight)
        completion(Timeline(entries: [entry], policy: .after(refreshAt)))
    }
}

/// The figure in the arcs' opening: what is left of the day's allowance.
private struct CalorieArcBlock: View {
    let snapshot: CalorieSnapshot
    let arcSize: CGFloat
    let lineWidth: CGFloat
    let numberFontSize: CGFloat

    private var remainingText: String {
        guard snapshot.hasData else { return "-" }
        return localizedNumberString(max(0, snapshot.remaining))
    }

    var body: some View {
        VStack(spacing: 1) {
            CalorieArcs(
                size: arcSize,
                lineWidth: lineWidth,
                eatenProgress: snapshot.progress,
                burnedProgress: snapshot.burnedProgress
            )
            .overlay(alignment: .bottom) {
                Text(remainingText)
                    .font(.system(size: numberFontSize, weight: .bold, design: .rounded))
                    .foregroundStyle(WidgetPalette.eaten)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                    .frame(maxWidth: arcSize * 0.5)
            }
            Text(localizedWidgetString("widget.kcal_left"))
                .font(.system(size: max(10, numberFontSize * 0.45), weight: .medium))
                .foregroundStyle(WidgetPalette.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            String(
                format: localizedWidgetString("widget.a11y.kcal_left"),
                remainingText
            )
        )
    }
}

/// One of the figures beside the arcs, as the nutrition card labels them:
/// a small mark and name, the number in the arc's own colour.
private struct CalorieFigure: View {
    let icon: String
    let label: String
    let value: Double
    let color: Color
    var alignment: HorizontalAlignment = .leading
    var valueFontSize: CGFloat = 17

    var body: some View {
        VStack(alignment: alignment, spacing: 1) {
            HStack(spacing: 3) {
                Image(systemName: icon)
                    .font(.system(size: valueFontSize * 0.55, weight: .semibold))
                    .foregroundStyle(color)
                Text(label)
                    .font(.system(size: max(10, valueFontSize * 0.65)))
                    .foregroundStyle(WidgetPalette.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            Text(localizedNumberString(value))
                .font(.system(size: valueFontSize, weight: .bold, design: .rounded))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .accessibilityElement(children: .combine)
    }
}

struct widgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    var entry: Provider.Entry

    private var dashboardURL: URL? {
        URL(string: "sparkyfitnessmobile://")
    }

    var body: some View {
        Group {
            switch family {
            case .systemSmall:
                smallBody
            case .accessoryCircular:
                circularBody
            case .accessoryRectangular:
                rectangularBody
            case .accessoryInline:
                inlineBody
            default:
                mediumBody
            }
        }
        .widgetURL(dashboardURL)
    }

    private var remainingText: String {
        guard entry.snapshot.hasData else { return "-" }
        return localizedNumberString(max(0, entry.snapshot.remaining))
    }

    /// The arcs across the top, Food and Burned under their ends.
    private var smallBody: some View {
        GeometryReader { geo in
            let arcSize = max(60, min(geo.size.width, (geo.size.height - 52) * 1.8))
            VStack(spacing: 6) {
                CalorieArcBlock(
                    snapshot: entry.snapshot,
                    arcSize: arcSize,
                    lineWidth: max(8, arcSize * 0.085),
                    numberFontSize: arcSize * 0.19
                )
                HStack(alignment: .bottom) {
                    CalorieFigure(
                        icon: "fork.knife",
                        label: localizedWidgetString("widget.food"),
                        value: entry.snapshot.food,
                        color: WidgetPalette.eaten,
                        valueFontSize: 15
                    )
                    Spacer(minLength: 4)
                    CalorieFigure(
                        icon: "flame.fill",
                        label: localizedWidgetString("widget.burned"),
                        value: entry.snapshot.burned,
                        color: WidgetPalette.move,
                        alignment: .trailing,
                        valueFontSize: 15
                    )
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }

    /// The nutrition card's row: arcs with the figure in their opening, the
    /// day's numbers beside them, and the logging shortcuts.
    private var mediumBody: some View {
        GeometryReader { geo in
            let isCompact = geo.size.width < 310
            let arcSize = max(80, min(isCompact ? 128 : 146, (geo.size.height - 20) * 1.7))

            HStack(spacing: isCompact ? 10 : 16) {
                CalorieArcBlock(
                    snapshot: entry.snapshot,
                    arcSize: arcSize,
                    lineWidth: isCompact ? 10 : 11,
                    numberFontSize: isCompact ? 24 : 28
                )

                VStack(alignment: .leading, spacing: 7) {
                    CalorieFigure(
                        icon: "fork.knife",
                        label: localizedWidgetString("widget.food"),
                        value: entry.snapshot.food,
                        color: WidgetPalette.eaten,
                        valueFontSize: 16
                    )
                    CalorieFigure(
                        icon: "flame.fill",
                        label: localizedWidgetString("widget.burned"),
                        value: entry.snapshot.burned,
                        color: WidgetPalette.move,
                        valueFontSize: 16
                    )
                    CalorieFigure(
                        icon: "target",
                        label: localizedWidgetString("widget.goal"),
                        value: entry.snapshot.goal,
                        color: WidgetPalette.textPrimary,
                        valueFontSize: 16
                    )
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                WidgetVerticalDivider()

                WidgetActionColumn()
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }

    /// Lock Screen: the system gauge is the same open-bottomed arc.
    private var circularBody: some View {
        Gauge(value: entry.snapshot.progress) {
            Image(systemName: "fork.knife")
        } currentValueLabel: {
            Text(remainingText)
                .minimumScaleFactor(0.5)
        }
        .gaugeStyle(.accessoryCircular)
        .widgetAccentable()
        .accessibilityLabel(
            String(format: localizedWidgetString("widget.a11y.kcal_left"), remainingText)
        )
    }

    private var rectangularBody: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(remainingText)
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .widgetAccentable()
                Text(localizedWidgetString("widget.kcal_left"))
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Gauge(value: entry.snapshot.progress) {
                EmptyView()
            }
            .gaugeStyle(.accessoryLinearCapacity)
            .widgetAccentable()
            HStack(spacing: 8) {
                Label(localizedNumberString(entry.snapshot.food), systemImage: "fork.knife")
                Label(localizedNumberString(entry.snapshot.burned), systemImage: "flame.fill")
            }
            .font(.system(size: 12, weight: .medium, design: .rounded))
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var inlineBody: some View {
        Label(
            String(format: localizedWidgetString("widget.a11y.kcal_left"), remainingText),
            systemImage: "fork.knife"
        )
    }
}

struct widget: Widget {
    let kind: String = "widget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            widgetEntryView(entry: entry)
                .widgetSurfaceBackground()
        }
        .configurationDisplayName("widget.calorie.name")
        .description("widget.calorie.description")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

#if DEBUG
    #Preview(as: .systemSmall) {
        widget()
    } timeline: {
        SimpleEntry(
            date: .now,
            snapshot: CalorieSnapshot(food: 1540, burned: 255, goal: 3055, remaining: 1515, progress: 0.5, burnGoal: 500, lastUpdated: .now)
        )
        SimpleEntry(date: .now, snapshot: .empty)
    }

    #Preview(as: .systemMedium) {
        widget()
    } timeline: {
        SimpleEntry(
            date: .now,
            snapshot: CalorieSnapshot(food: 1540, burned: 255, goal: 3055, remaining: 1515, progress: 0.5, burnGoal: 500, lastUpdated: .now)
        )
        SimpleEntry(date: .now, snapshot: .empty)
    }

    #Preview(as: .accessoryRectangular) {
        widget()
    } timeline: {
        SimpleEntry(
            date: .now,
            snapshot: CalorieSnapshot(food: 1540, burned: 255, goal: 3055, remaining: 1515, progress: 0.5, burnGoal: 500, lastUpdated: .now)
        )
    }
#endif
