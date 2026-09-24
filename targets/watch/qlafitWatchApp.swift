import SwiftUI
import WatchKit
import HealthKit

final class WatchAppDelegate: NSObject, WKApplicationDelegate {
  func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
    // A background launch must open its HealthKit session immediately; waiting
    // for WatchConnectivity first can leave the app asleep without a workout.
    Task { @MainActor in WorkoutManager.shared.startFromPhoneLaunch(workoutConfiguration) }
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
