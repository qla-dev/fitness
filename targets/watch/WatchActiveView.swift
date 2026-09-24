import SwiftUI

/// Swiping changes pages; the Digital Crown scrolls each page independently.
struct WatchActiveView: View {
  @EnvironmentObject private var manager: WorkoutManager
  @State private var confirmStop = false

  private func metric(_ key: String) -> Double { manager.phoneMetrics[key] as? Double ?? 0 }
  private var miles: Bool { manager.dashboard["distanceUnit"] as? String == "miles" }
  private var distanceUnit: String { miles ? watchText("unit.miles", "mi") : watchText("unit.km", "km") }
  private var metresPerUnit: Double { miles ? 1609.344 : 1000 }
  private var distance: Double { manager.isPhoneWorkout ? metric("distance") : manager.distance }
  private var hasMetrics: Bool { !manager.isPhoneWorkout || !manager.phoneMetrics.isEmpty }
  private var speedUnit: String { miles ? watchText("unit.mph", "mph") : watchText("unit.kmh", "km/h") }
  private var paceLabel: String {
    if manager.sport.activityType == .cycling {
      return manager.isPhoneWorkout ? watchText("metric.speed", "Speed") : watchText("metric.averageSpeed", "Average speed")
    }
    return manager.isPhoneWorkout ? watchText("metric.pace", "Pace") : watchText("metric.averagePace", "Average pace")
  }

  var body: some View {
    TabView {
      NavigationStack {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
          ScrollView {
            VStack(alignment: .leading, spacing: 8) {
              HStack(alignment: .top, spacing: 8) {
                WatchMetric(label: paceLabel, value: paceOrSpeed(at: timeline.date))
                WatchMetric(label: watchText("metric.distance", "Distance") + " · " + distanceUnit,
                  value: hasMetrics ? watchNumber(distance / metresPerUnit, digits: 2) : "—")
              }
              HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(timeline.date.timeIntervalSince(manager.heartRateAt) < 15 && manager.heartRate > 0
                  ? watchNumber(manager.heartRate) : "—")
                  .font(.system(size: 56, weight: .regular, design: .rounded)).monospacedDigit()
                  .contentTransition(.numericText())
                Image(systemName: "heart.fill").foregroundStyle(.pink)
                Text(watchText("unit.bpm", "BPM")).font(.caption2).foregroundStyle(.secondary)
              }.accessibilityElement(children: .combine)
              WatchMetric(label: watchText("metric.elapsed", "Elapsed"), value: elapsed(at: timeline.date), color: .yellow)
              if manager.isPaused {
                Text(watchText("workout.paused", "Paused")).foregroundStyle(.yellow)
              }
              if manager.isPhoneWorkout && !fresh(at: timeline.date) {
                Text(watchText("workout.waiting", "Waiting for live data from iPhone"))
                  .font(.caption2).foregroundStyle(.secondary)
              }
            }.padding(.horizontal, 6).padding(.bottom, 20)
          }
        }
        .navigationTitle(watchText("workout.metrics", "Metrics"))
      }
      NavigationStack {
        ScrollView {
          VStack(alignment: .leading, spacing: 14) {
            Label(manager.sport.name, systemImage: manager.sport.symbol)
              .font(.caption2).foregroundStyle(manager.sport.tint)
            WatchMetric(label: manager.isPhoneWorkout ? watchText("metric.estimatedCalories", "Estimated calories") : watchText("home.activeCalories", "Active calories"),
              value: hasMetrics ? watchNumber(manager.isPhoneWorkout ? metric("calories") : manager.activeCalories) + " " + watchText("unit.kcal", "kcal") : "—", color: .orange)
            WatchMetric(label: watchText("metric.averageHeartRate", "Average heart rate"),
              value: manager.averageHeartRate > 0 ? watchNumber(manager.averageHeartRate) + " " + watchText("unit.bpm", "BPM") : "—", color: .pink)
            WatchMetric(label: watchText("metric.maxHeartRate", "Maximum heart rate"),
              value: manager.maxHeartRate > 0 ? watchNumber(manager.maxHeartRate) + " " + watchText("unit.bpm", "BPM") : "—", color: .pink)
            if manager.isPhoneWorkout {
              WatchMetric(label: watchText("metric.maxSpeed", "Maximum speed"),
                value: hasMetrics ? watchNumber(metric("maxSpeed") * 3600 / metresPerUnit, digits: 1) + " " + speedUnit : "—")
              WatchMetric(label: watchText("metric.elevation", "Elevation gain"),
                value: hasMetrics ? watchNumber(metric("elevationGain") * (miles ? 3.28084 : 1)) + " " +
                  (miles ? watchText("unit.feet", "ft") : watchText("unit.metres", "m")) : "—")
              Text(watchText("workout.phoneControls", "Pause or finish this workout on iPhone."))
                .font(.footnote).foregroundStyle(.secondary)
            } else {
              Button(role: .destructive) { confirmStop = true } label: {
                Label(watchText("workout.stop", "Stop"), systemImage: "stop.fill")
              }.buttonStyle(.borderedProminent).tint(.red)
            }
            ErrorNote()
          }.padding(.horizontal, 6).padding(.bottom, 20)
        }
        .navigationTitle(watchText("workout.details", "Details"))
      }
    }
    .tabViewStyle(.page)
    .confirmationDialog(watchText("workout.finishTitle", "Finish this workout?"), isPresented: $confirmStop) {
      Button(watchText("workout.finish", "Finish and save"), role: .destructive) { manager.stop() }
      Button(watchText("common.cancel", "Cancel"), role: .cancel) {}
    }
  }

  private func fresh(at date: Date) -> Bool {
    date.timeIntervalSince1970 * 1000 - metric("timestamp") < 15_000
  }

  private func elapsed(at date: Date) -> String {
    guard hasMetrics else { return "—" }
    if !manager.isPhoneWorkout { return watchClock(date.timeIntervalSince(manager.startedAt)) }
    let extra = !manager.isPaused
      ? min(15, max(0, date.timeIntervalSince1970 - metric("timestamp") / 1000)) : 0
    return watchClock(metric("elapsed") + extra)
  }

  private func paceOrSpeed(at date: Date) -> String {
    guard hasMetrics else { return "—" }
    let speed: Double
    if manager.isPhoneWorkout {
      guard fresh(at: date), !manager.isPaused else { return "—" }
      speed = metric("speed")
    } else {
      // Standalone sessions show average pace from HealthKit distance.
      speed = distance / max(1, date.timeIntervalSince(manager.startedAt))
    }
    guard speed > 0.5 else { return "—" }
    return manager.sport.activityType == .cycling
      ? watchNumber(speed * 3600 / metresPerUnit, digits: 1) + " " + speedUnit
      : watchClock(metresPerUnit / speed)
  }
}
