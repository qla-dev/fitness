import WidgetKit
import SwiftUI

struct MacroSnapshot {
    let proteinGrams: Double
    let carbsGrams: Double
    let fatGrams: Double
    let caloriesConsumed: Double
    /// Each macro's goal; 0 when unset or when an older snapshot lacks it.
    var proteinGoal: Double = 0
    var carbsGoal: Double = 0
    var fatGoal: Double = 0
    let lastUpdated: Date?

    var proteinKcal: Double { proteinGrams * 4 }
    var carbsKcal:   Double { carbsGrams   * 4 }
    var fatKcal:     Double { fatGrams     * 9 }
    var macroKcalTotal: Double { proteinKcal + carbsKcal + fatKcal }
    var hasData: Bool { macroKcalTotal > 0 || caloriesConsumed > 0 }

    static let empty = MacroSnapshot(
        proteinGrams: 0, carbsGrams: 0, fatGrams: 0,
        caloriesConsumed: 0, lastUpdated: nil
    )
}

private struct MacroSnapshotPayload: Decodable {
    let date: String?
    let protein: Double?
    let carbs: Double?
    let fat: Double?
    let calories: Double?
    let proteinGoal: Double?
    let carbsGoal: Double?
    let fatGoal: Double?
    let lastUpdated: Double?
}

private func loadMacroSnapshot() -> MacroSnapshot {
    guard
        let appGroup = appGroupIdentifier(),
        !appGroup.isEmpty,
        let defaults = UserDefaults(suiteName: appGroup),
        let data = defaults.data(forKey: "macroSnapshot"),
        let payload = try? JSONDecoder().decode(MacroSnapshotPayload.self, from: data),
        isToday(payload.date)
    else {
        return .empty
    }
    return MacroSnapshot(
        proteinGrams: payload.protein ?? 0,
        carbsGrams: payload.carbs ?? 0,
        fatGrams: payload.fat ?? 0,
        caloriesConsumed: payload.calories ?? 0,
        proteinGoal: payload.proteinGoal ?? 0,
        carbsGoal: payload.carbsGoal ?? 0,
        fatGoal: payload.fatGoal ?? 0,
        lastUpdated: payload.lastUpdated.map { Date(timeIntervalSince1970: $0) }
    )
}

struct MacroEntry: TimelineEntry {
    let date: Date
    let snapshot: MacroSnapshot
}

struct MacroProvider: TimelineProvider {
    func placeholder(in context: Context) -> MacroEntry {
        MacroEntry(date: Date(), snapshot: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (MacroEntry) -> Void) {
        completion(MacroEntry(date: Date(), snapshot: loadMacroSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MacroEntry>) -> Void) {
        let now = Date()
        let entry = MacroEntry(date: now, snapshot: loadMacroSnapshot())
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

private enum MacroKind: CaseIterable {
    case protein, carbs, fat

    /// Resolved through literal keys so the widget key contract can find them.
    var label: String {
        switch self {
        case .protein: return localizedWidgetString("widget.protein")
        case .carbs: return localizedWidgetString("widget.carbs")
        case .fat: return localizedWidgetString("widget.fat")
        }
    }

    var color: Color {
        switch self {
        case .protein: return WidgetPalette.protein
        case .carbs: return WidgetPalette.carbs
        case .fat: return WidgetPalette.fat
        }
    }
}

private extension MacroSnapshot {
    func grams(_ kind: MacroKind) -> Double {
        switch kind {
        case .protein: return proteinGrams
        case .carbs: return carbsGrams
        case .fat: return fatGrams
        }
    }

    func goal(_ kind: MacroKind) -> Double {
        switch kind {
        case .protein: return proteinGoal
        case .carbs: return carbsGoal
        case .fat: return fatGoal
        }
    }

    /// Progress toward the macro's own goal, as the Tracker's nutrient rings
    /// fill. A snapshot without goals (written before they were sent, or a
    /// macro with no goal set) falls back to the macro's share of the day's
    /// macro calories, so the ring still carries a signal.
    func progress(_ kind: MacroKind) -> Double {
        let target = goal(kind)
        if target > 0 { return ratio(grams(kind), of: target) }
        guard macroKcalTotal > 0 else { return 0 }
        let kcal: Double
        switch kind {
        case .protein: kcal = proteinKcal
        case .carbs: kcal = carbsKcal
        case .fat: kcal = fatKcal
        }
        return clampedProgress(kcal / macroKcalTotal)
    }
}

/// One nutrient as the Tracker draws it: a ring in its colour with what has
/// been eaten inside, its name under it, and what is left under that.
private struct MacroRingItem: View {
    let kind: MacroKind
    let snapshot: MacroSnapshot
    let ringSize: CGFloat
    let lineWidth: CGFloat
    let valueFontSize: CGFloat
    var showsRemaining: Bool = true

    private var gramsText: String {
        String(
            format: localizedWidgetString("widget.grams"),
            localizedNumberString(snapshot.grams(kind))
        )
    }

    private var remainingText: String? {
        let goal = snapshot.goal(kind)
        guard goal > 0 else { return nil }
        return String(
            format: localizedWidgetString("widget.grams_left"),
            localizedNumberString(max(0, goal - snapshot.grams(kind)))
        )
    }

    var body: some View {
        VStack(spacing: 3) {
            WidgetRing(
                progress: snapshot.progress(kind),
                color: kind.color,
                trackColor: WidgetPalette.track,
                lineWidth: lineWidth
            )
            .frame(width: ringSize, height: ringSize)
            .overlay {
                Text(gramsText)
                    .font(.system(size: valueFontSize, weight: .bold, design: .rounded))
                    .foregroundStyle(WidgetPalette.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .padding(.horizontal, lineWidth + 2)
            }
            Text(kind.label)
                .font(.system(size: max(10, valueFontSize * 0.85), weight: .semibold))
                .foregroundStyle(kind.color)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if showsRemaining {
                Text(remainingText ?? " ")
                    .font(.system(size: max(9, valueFontSize * 0.75)))
                    .foregroundStyle(WidgetPalette.textMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

/// The day's calories above the rings, as a figure rather than another gauge.
private struct MacroCalorieHeader: View {
    let snapshot: MacroSnapshot
    let fontSize: CGFloat

    private var centerText: String {
        guard snapshot.hasData else { return "-" }
        return localizedNumberString(snapshot.caloriesConsumed)
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Image(systemName: "fork.knife")
                .font(.system(size: fontSize * 0.6, weight: .semibold))
                .foregroundStyle(WidgetPalette.eaten)
            Text(centerText)
                .font(.system(size: fontSize, weight: .bold, design: .rounded))
                .foregroundStyle(WidgetPalette.eaten)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(localizedWidgetString("widget.kcal"))
                .font(.system(size: fontSize * 0.6, weight: .medium))
                .foregroundStyle(WidgetPalette.textSecondary)
                .lineLimit(1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            String(
                format: localizedWidgetString("widget.a11y.kcal"),
                centerText
            )
        )
    }
}

struct macroWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    var entry: MacroProvider.Entry

    private var dashboardURL: URL? {
        URL(string: "sparkyfitnessmobile://")
    }

    var body: some View {
        Group {
            switch family {
            case .systemSmall:
                smallBody
            default:
                mediumBody
            }
        }
        .widgetURL(dashboardURL)
    }

    private var smallBody: some View {
        GeometryReader { geo in
            let ringSize = max(30, min(42, (geo.size.width - 12) / 3))
            VStack(alignment: .leading, spacing: 10) {
                MacroCalorieHeader(snapshot: entry.snapshot, fontSize: 22)
                Spacer(minLength: 0)
                HStack(alignment: .top, spacing: 4) {
                    ForEach(MacroKind.allCases, id: \.self) { kind in
                        MacroRingItem(
                            kind: kind,
                            snapshot: entry.snapshot,
                            ringSize: ringSize,
                            lineWidth: 5,
                            valueFontSize: 10,
                            showsRemaining: false
                        )
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .leading)
        }
    }

    private var mediumBody: some View {
        GeometryReader { geo in
            let isCompact = geo.size.width < 310
            let ringSize: CGFloat = min(isCompact ? 56 : 62, geo.size.height - 62)

            HStack(spacing: isCompact ? 8 : 14) {
                VStack(alignment: .leading, spacing: 6) {
                    MacroCalorieHeader(snapshot: entry.snapshot, fontSize: 17)
                    HStack(alignment: .top, spacing: isCompact ? 2 : 6) {
                        ForEach(MacroKind.allCases, id: \.self) { kind in
                            MacroRingItem(
                                kind: kind,
                                snapshot: entry.snapshot,
                                ringSize: ringSize,
                                lineWidth: 7,
                                valueFontSize: 13
                            )
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                WidgetVerticalDivider()

                WidgetActionColumn()
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }
}

struct macroWidget: Widget {
    let kind: String = "macroWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MacroProvider()) { entry in
            macroWidgetEntryView(entry: entry)
                .widgetSurfaceBackground()
        }
        .configurationDisplayName("widget.macro.name")
        .description("widget.macro.description")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#if DEBUG
    #Preview(as: .systemSmall) {
        macroWidget()
    } timeline: {
        MacroEntry(
            date: .now,
            snapshot: MacroSnapshot(proteinGrams: 92, carbsGrams: 180, fatGrams: 55, caloriesConsumed: 1540, proteinGoal: 150, carbsGoal: 200, fatGoal: 65, lastUpdated: .now)
        )
        MacroEntry(date: .now, snapshot: .empty)
    }

    #Preview(as: .systemMedium) {
        macroWidget()
    } timeline: {
        MacroEntry(
            date: .now,
            snapshot: MacroSnapshot(proteinGrams: 92, carbsGrams: 180, fatGrams: 55, caloriesConsumed: 1540, proteinGoal: 150, carbsGoal: 200, fatGoal: 65, lastUpdated: .now)
        )
        MacroEntry(date: .now, snapshot: .empty)
    }
#endif
