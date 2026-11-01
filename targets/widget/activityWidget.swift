import WidgetKit
import SwiftUI

/// Move, Exercise and Steps for today, as the Dashboard's Activity Rings card
/// reads them. Written by useWidgetSync as `activitySnapshot`.
struct ActivitySnapshot {
    let move: Double
    let moveGoal: Double
    let exercise: Double
    let exerciseGoal: Double
    let steps: Double
    let stepsGoal: Double
    let lastUpdated: Date?

    static let empty = ActivitySnapshot(
        move: 0, moveGoal: 0, exercise: 0, exerciseGoal: 0,
        steps: 0, stepsGoal: 0, lastUpdated: nil
    )

    var moveProgress: Double { ratio(move, of: moveGoal) }
    var exerciseProgress: Double { ratio(exercise, of: exerciseGoal) }
    var stepsProgress: Double { ratio(steps, of: stepsGoal) }
}

private struct ActivitySnapshotPayload: Decodable {
    let date: String?
    let move: Double?
    let moveGoal: Double?
    let exercise: Double?
    let exerciseGoal: Double?
    let steps: Double?
    let stepsGoal: Double?
    let lastUpdated: Double?
}

private func loadActivitySnapshot() -> ActivitySnapshot {
    guard
        let appGroup = appGroupIdentifier(),
        !appGroup.isEmpty,
        let defaults = UserDefaults(suiteName: appGroup),
        let data = defaults.data(forKey: "activitySnapshot"),
        let payload = try? JSONDecoder().decode(ActivitySnapshotPayload.self, from: data),
        isToday(payload.date)
    else {
        return .empty
    }
    return ActivitySnapshot(
        move: payload.move ?? 0,
        moveGoal: payload.moveGoal ?? 0,
        exercise: payload.exercise ?? 0,
        exerciseGoal: payload.exerciseGoal ?? 0,
        steps: payload.steps ?? 0,
        stepsGoal: payload.stepsGoal ?? 0,
        lastUpdated: payload.lastUpdated.map { Date(timeIntervalSince1970: $0) }
    )
}

struct ActivityEntry: TimelineEntry {
    let date: Date
    let snapshot: ActivitySnapshot
}

struct ActivityProvider: TimelineProvider {
    func placeholder(in context: Context) -> ActivityEntry {
        ActivityEntry(date: Date(), snapshot: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (ActivityEntry) -> Void) {
        completion(ActivityEntry(date: Date(), snapshot: loadActivitySnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ActivityEntry>) -> Void) {
        let now = Date()
        let entry = ActivityEntry(date: now, snapshot: loadActivitySnapshot())
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

private enum ActivityMetric: CaseIterable {
    case move, exercise, steps

    /// Resolved through literal keys so the widget key contract can find them.
    var label: String {
        switch self {
        case .move: return localizedWidgetString("widget.move")
        case .exercise: return localizedWidgetString("widget.exercise")
        case .steps: return localizedWidgetString("widget.steps")
        }
    }

    var icon: String {
        switch self {
        case .move: return "flame.fill"
        case .exercise: return "figure.run"
        case .steps: return "figure.walk"
        }
    }

    var color: Color {
        switch self {
        case .move: return WidgetPalette.move
        case .exercise: return WidgetPalette.exercise
        case .steps: return WidgetPalette.steps
        }
    }
}

private extension ActivitySnapshot {
    func value(_ metric: ActivityMetric) -> Double {
        switch metric {
        case .move: return move
        case .exercise: return exercise
        case .steps: return steps
        }
    }

    func goal(_ metric: ActivityMetric) -> Double {
        switch metric {
        case .move: return moveGoal
        case .exercise: return exerciseGoal
        case .steps: return stepsGoal
        }
    }

    /// "245/500", or the bare figure without a goal — the card's legend.
    func figure(_ metric: ActivityMetric) -> String {
        let valueText = localizedNumberString(value(metric))
        let target = goal(metric)
        guard target > 0 else { return valueText }
        return "\(valueText)/\(localizedNumberString(target))"
    }

    /// The unit the legend closes on; steps carry none, as in the app.
    func unit(_ metric: ActivityMetric) -> String? {
        switch metric {
        case .move: return localizedWidgetString("widget.kcal")
        case .exercise: return localizedWidgetString("widget.min")
        case .steps: return nil
        }
    }
}

/// One line of the card's legend: mark and name, then value/goal in colour.
private struct ActivityLegendRow: View {
    let metric: ActivityMetric
    let snapshot: ActivitySnapshot
    let valueFontSize: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Image(systemName: metric.icon)
                    .font(.system(size: valueFontSize * 0.7, weight: .semibold))
                    .foregroundStyle(metric.color)
                Text(metric.label)
                    .font(.system(size: valueFontSize * 0.75))
                    .foregroundStyle(WidgetPalette.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(snapshot.figure(metric))
                    .font(.system(size: valueFontSize, weight: .bold, design: .rounded))
                    .foregroundStyle(metric.color)
                if let unit = snapshot.unit(metric) {
                    Text(unit)
                        .font(.system(size: valueFontSize * 0.7, weight: .semibold, design: .rounded))
                        .foregroundStyle(metric.color)
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.5)
        }
        .accessibilityElement(children: .combine)
    }
}

/// A compact column for the small family: the figure in colour over its name.
private struct ActivityFigure: View {
    let metric: ActivityMetric
    let snapshot: ActivitySnapshot

    var body: some View {
        VStack(spacing: 0) {
            Text(localizedNumberString(snapshot.value(metric)))
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(metric.color)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            Image(systemName: metric.icon)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(metric.color.opacity(0.8))
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            Text(verbatim: "\(metric.label) \(snapshot.figure(metric))")
        )
    }
}

struct activityWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var renderingMode
    var entry: ActivityProvider.Entry

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
            default:
                mediumBody
            }
        }
        .widgetURL(dashboardURL)
    }

    private func rings(size: CGFloat) -> some View {
        ActivityRings(
            size: size,
            move: entry.snapshot.moveProgress,
            exercise: entry.snapshot.exerciseProgress,
            steps: entry.snapshot.stepsProgress
        )
        .accessibilityHidden(true)
    }

    /// The Lock Screen draws in one tint, so the rings tell themselves apart
    /// by weight instead of hue there.
    private func accessoryRings(size: CGFloat) -> some View {
        let colors: [Color] = renderingMode == .fullColor
            ? [WidgetPalette.move, WidgetPalette.exercise, WidgetPalette.steps]
            : [.primary, .primary.opacity(0.75), .primary.opacity(0.55)]
        return ActivityRings(
            size: size,
            move: entry.snapshot.moveProgress,
            exercise: entry.snapshot.exerciseProgress,
            steps: entry.snapshot.stepsProgress,
            colors: colors,
            trackOpacity: 0.22,
            strokeScale: 1.1
        )
        .widgetAccentable()
        .accessibilityHidden(true)
    }

    private var smallBody: some View {
        GeometryReader { geo in
            let ringSize = max(60, min(geo.size.width, geo.size.height - 34))
            VStack(spacing: 6) {
                rings(size: ringSize)
                HStack(spacing: 2) {
                    ForEach(ActivityMetric.allCases, id: \.self) { metric in
                        ActivityFigure(metric: metric, snapshot: entry.snapshot)
                    }
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }

    private var mediumBody: some View {
        GeometryReader { geo in
            let ringSize = min(geo.size.height, geo.size.width * 0.45)
            HStack(spacing: 14) {
                rings(size: ringSize)
                VStack(alignment: .leading, spacing: 5) {
                    ForEach(ActivityMetric.allCases, id: \.self) { metric in
                        ActivityLegendRow(
                            metric: metric,
                            snapshot: entry.snapshot,
                            valueFontSize: 17
                        )
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }

    private var circularBody: some View {
        GeometryReader { geo in
            accessoryRings(size: min(geo.size.width, geo.size.height))
                .frame(width: geo.size.width, height: geo.size.height)
        }
    }

    private var rectangularBody: some View {
        HStack(spacing: 8) {
            GeometryReader { geo in
                accessoryRings(size: min(geo.size.width, geo.size.height))
                    .frame(width: geo.size.width, height: geo.size.height)
            }
            .aspectRatio(1, contentMode: .fit)
            VStack(alignment: .leading, spacing: 0) {
                ForEach(ActivityMetric.allCases, id: \.self) { metric in
                    HStack(spacing: 3) {
                        Image(systemName: metric.icon)
                            .font(.system(size: 10, weight: .semibold))
                        Text(entry.snapshot.figure(metric))
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(
                        Text(verbatim: "\(metric.label) \(entry.snapshot.figure(metric))")
                    )
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct activityWidget: Widget {
    let kind: String = "activityWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ActivityProvider()) { entry in
            activityWidgetEntryView(entry: entry)
                .widgetSurfaceBackground()
        }
        .configurationDisplayName("widget.activity.name")
        .description("widget.activity.description")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular,
        ])
    }
}

#if DEBUG
    #Preview(as: .systemSmall) {
        activityWidget()
    } timeline: {
        ActivityEntry(
            date: .now,
            snapshot: ActivitySnapshot(
                move: 320, moveGoal: 500, exercise: 18, exerciseGoal: 30,
                steps: 6240, stepsGoal: 10000, lastUpdated: .now
            )
        )
        ActivityEntry(date: .now, snapshot: .empty)
    }

    #Preview(as: .systemMedium) {
        activityWidget()
    } timeline: {
        ActivityEntry(
            date: .now,
            snapshot: ActivitySnapshot(
                move: 320, moveGoal: 500, exercise: 18, exerciseGoal: 30,
                steps: 6240, stepsGoal: 10000, lastUpdated: .now
            )
        )
    }

    #Preview(as: .accessoryCircular) {
        activityWidget()
    } timeline: {
        ActivityEntry(
            date: .now,
            snapshot: ActivitySnapshot(
                move: 320, moveGoal: 500, exercise: 18, exerciseGoal: 30,
                steps: 6240, stepsGoal: 10000, lastUpdated: .now
            )
        )
    }
#endif
