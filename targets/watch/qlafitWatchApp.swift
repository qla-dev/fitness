import SwiftUI
import WatchKit
import HealthKit

final class WatchAppDelegate: NSObject, WKApplicationDelegate {
  func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
    // Fetch the current command after waking. Its exact sport wins over the
    // generic launch configuration; a stopped phone cannot start a late workout.
    Task { @MainActor in WorkoutManager.shared.requestPhoneWorkout() }
  }
}

@main
struct QlafitWatchApp: App {
  @WKApplicationDelegateAdaptor(WatchAppDelegate.self) private var appDelegate
  /// One manager for the whole app: it owns the HealthKit workout session and
  /// the WCSession delegate, both of which must outlive any individual view.
  @StateObject private var workoutManager = WorkoutManager.shared

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(workoutManager)
        .task { await workoutManager.requestAuthorization() }
    }
  }
}
