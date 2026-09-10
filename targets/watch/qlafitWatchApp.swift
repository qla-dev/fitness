import SwiftUI

@main
struct QlafitWatchApp: App {
  /// One manager for the whole app: it owns the HealthKit workout session and
  /// the WCSession delegate, both of which must outlive any individual view.
  @StateObject private var workoutManager = WorkoutManager()

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(workoutManager)
        .task { await workoutManager.requestAuthorization() }
    }
  }
}
