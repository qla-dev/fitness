import SwiftUI

/// Deliberately minimal: this app exists to hold a workout session open so the
/// sensor streams, not to be a second recorder. Distance, pace and the route
/// stay on the phone, which owns GPS and the saved activity.
struct ContentView: View {
  @EnvironmentObject private var workoutManager: WorkoutManager

  var body: some View {
    VStack(spacing: 8) {
      if workoutManager.isRunning {
        activeView
      } else {
        idleView
      }
      if let error = workoutManager.lastError {
        Text(error)
          .font(.footnote)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
      }
    }
    .padding()
  }

  private var activeView: some View {
    VStack(spacing: 4) {
      Text(workoutManager.heartRate > 0
        ? String(format: "%.0f", workoutManager.heartRate)
        : "--")
        .font(.system(size: 44, weight: .semibold, design: .rounded))
        .monospacedDigit()
      Text("BPM")
        .font(.caption)
        .foregroundStyle(.secondary)
      Button("Stop", role: .destructive) { workoutManager.stop() }
        .padding(.top, 4)
    }
  }

  private var idleView: some View {
    VStack(spacing: 8) {
      Text("qla.fit")
        .font(.headline)
      Text("Start a run or ride to stream your heart rate to your phone.")
        .font(.caption)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
      Button("Run") { workoutManager.start(sport: .run) }
      Button("Ride") { workoutManager.start(sport: .ride) }
    }
  }
}
