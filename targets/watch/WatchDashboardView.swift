import SwiftUI

func watchText(_ key: String, _ fallback: String) -> String {
  NSLocalizedString(key, value: fallback, comment: "")
}

func watchNumber(_ value: Double, digits: Int = 0) -> String {
  value.formatted(.number.precision(.fractionLength(0...digits)))
}

func watchClock(_ seconds: Double) -> String {
  let whole = max(0, Int(seconds))
  return whole >= 3600
    ? String(format: "%d:%02d:%02d", whole / 3600, (whole / 60) % 60, whole % 60)
    : String(format: "%d:%02d", whole / 60, whole % 60)
}

struct WatchMetric: View {
  let label: String
  let value: String
  var color: Color = .white

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(label).font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary)
      Text(value).font(.system(size: 26, weight: .medium, design: .rounded))
        .foregroundStyle(color).monospacedDigit().minimumScaleFactor(0.6).lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .combine)
  }
}

struct WatchDashboardView: View {
  @EnvironmentObject private var manager: WorkoutManager
  private func number(_ key: String) -> Double { manager.dashboard[key] as? Double ?? 0 }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 12) {
          ErrorNote()
          if manager.dashboard.isEmpty {
            Image(systemName: "iphone.and.arrow.forward").font(.largeTitle).foregroundStyle(.cyan)
            Text(watchText("home.empty", "Open the phone dashboard to sync your daily activity."))
              .font(.footnote)
          } else {
            if !Calendar.current.isDateInToday(Date(timeIntervalSince1970: number("updatedAt") / 1000)) {
              Text(watchText("home.outdated", "Showing the last synced day. Open the phone dashboard to update."))
                .font(.caption2).foregroundStyle(.orange)
            }
            HStack(spacing: 8) {
              ZStack {
                ring(value: number("move"), goal: number("moveGoal"), color: .pink, inset: 0)
                ring(value: number("exercise"), goal: number("exerciseGoal"), color: .green, inset: 10)
                ring(value: number("stand"), goal: number("standGoal"), color: .cyan, inset: 20)
              }.frame(width: 76, height: 76).accessibilityHidden(true)
              VStack(alignment: .leading, spacing: 5) {
                total(watchText("home.move", "Move"), "move", "moveGoal", watchText("unit.kcal", "kcal"), .pink)
                total(watchText("home.exercise", "Exercise"), "exercise", "exerciseGoal", watchText("unit.minutes", "min"), .green)
                total(watchText("home.stand", "Stand"), "stand", "standGoal", watchText("unit.hours", "h"), .cyan)
              }
            }
            .padding(8).background(.orange.opacity(0.16), in: RoundedRectangle(cornerRadius: 14))

            card(watchText("home.activeCalories", "Active calories"), watchNumber(number("move")) + " " + watchText("unit.kcal", "kcal"), .pink)
            card(watchText("home.steps", "Steps"), watchNumber(number("steps")), .cyan)
            card(watchText("metric.distance", "Distance"), watchNumber(number("distance"), digits: 2) + " " +
              (manager.dashboard["distanceUnit"] as? String == "miles" ? watchText("unit.miles", "mi") : watchText("unit.km", "km")), .cyan)
            card(watchText("home.food", "Food"), watchNumber(number("calories")) + " / " + watchNumber(number("calorieGoal")) + " " + watchText("unit.kcal", "kcal"), .orange)
            card(watchText("home.water", "Water"), watchNumber(number("water")) + " / " + watchNumber(number("waterGoal")) + " " + watchText("unit.ml", "ml"), .blue)
            VStack(alignment: .leading, spacing: 2) {
              Text(watchText("home.lastSynced", "Last synced from phone"))
              Text(Date(timeIntervalSince1970: number("updatedAt") / 1000), format: .dateTime.month().day().hour().minute())
            }.font(.caption2).foregroundStyle(.secondary)
          }
          Text(watchText("home.activitiesHint", "Swipe to the next page for activities"))
            .font(.caption2).foregroundStyle(.secondary)
        }.padding(.horizontal, 4).padding(.bottom, 20)
      }
      .navigationTitle(watchText("home.title", "Home"))
    }
  }

  private func ring(value: Double, goal: Double, color: Color, inset: CGFloat) -> some View {
    ZStack {
      Circle().stroke(color.opacity(0.2), lineWidth: 7)
      Circle().trim(from: 0, to: goal > 0 ? min(max(value / goal, 0), 1) : 0)
        .stroke(color, style: StrokeStyle(lineWidth: 7, lineCap: .round))
        .rotationEffect(.degrees(-90))
    }.padding(inset)
  }

  private func total(_ label: String, _ key: String, _ goal: String, _ unit: String, _ color: Color) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(label).font(.system(size: 10))
      Text(watchNumber(number(key)) + "/" + watchNumber(number(goal)) + " " + unit)
        .font(.system(size: 11, weight: .semibold)).minimumScaleFactor(0.7).lineLimit(1)
    }.foregroundStyle(color).accessibilityElement(children: .combine)
  }

  private func card(_ label: String, _ value: String, _ color: Color) -> some View {
    WatchMetric(label: label, value: value, color: color)
      .padding(10).background(color.opacity(0.15), in: RoundedRectangle(cornerRadius: 14))
  }
}
