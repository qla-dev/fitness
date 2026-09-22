import HealthKit
import SwiftUI

/// The sports the watch can start, mirroring `WORKOUT_SPORTS` in
/// src/constants/workoutSports.ts.
///
/// Duplicated by hand for the same reason the message keys are: a watchOS
/// target cannot import from the React Native side. The `id` of every entry
/// must stay identical to the catalogue's, because it is what crosses the
/// WatchConnectivity boundary when the phone starts a session.
///
/// Names are English here. The watch target ships no `.lproj` catalogs — it is
/// a separate localization surface from the RN app, like the widgets — so the
/// strings it draws are literal until that surface exists.
struct WatchSport: Identifiable, Hashable {
  let id: String
  let name: String
  /// SF Symbol, chosen to match the phone's icon for the same sport.
  let symbol: String
  let tint: Color
  let activityType: HKWorkoutActivityType
  let locationType: HKWorkoutSessionLocationType
  let group: WatchSportGroup
}

/// How the list is sectioned, matching the phone's `SportGroup`.
enum WatchSportGroup: String, CaseIterable, Identifiable {
  case moving
  case stationary
  case ball
  case studio
  case strength

  var id: String { rawValue }

  var title: String {
    switch self {
    case .moving: return "Moving"
    case .stationary: return "Stationary"
    case .ball: return "Ball"
    case .studio: return "Studio"
    case .strength: return "Strength"
    }
  }
}

/// How long the 3-2-1 runs. The phone counts the same three seconds before it
/// starts recording (COUNTDOWN_SECONDS in RecordingCountdown.tsx), so a
/// session started from either side ends its count at the same moment.
enum WatchCountdown {
  static let seconds: TimeInterval = 3
}

enum WatchSportCatalogue {
  /// In the phone's order: the two GPS-recorded sports first, because they are
  /// the ones a session is usually started as.
  static let all: [WatchSport] = [
    WatchSport(
      id: "running", name: "Running", symbol: "figure.run", tint: .orange,
      activityType: .running, locationType: .outdoor, group: .moving),
    WatchSport(
      id: "cycling", name: "Cycling", symbol: "figure.outdoor.cycle", tint: .green,
      activityType: .cycling, locationType: .outdoor, group: .moving),
    WatchSport(
      id: "walking", name: "Walking", symbol: "figure.walk", tint: .teal,
      activityType: .walking, locationType: .outdoor, group: .moving),
    WatchSport(
      id: "hiking", name: "Hiking", symbol: "figure.hiking", tint: .brown,
      activityType: .hiking, locationType: .outdoor, group: .moving),
    WatchSport(
      id: "swimming", name: "Swimming", symbol: "figure.pool.swim", tint: .cyan,
      activityType: .swimming, locationType: .indoor, group: .moving),
    WatchSport(
      id: "rowing", name: "Rowing", symbol: "figure.rower", tint: .blue,
      activityType: .rowing, locationType: .indoor, group: .stationary),
    WatchSport(
      id: "elliptical", name: "Elliptical", symbol: "figure.elliptical", tint: .indigo,
      activityType: .elliptical, locationType: .indoor, group: .stationary),
    WatchSport(
      id: "stair-climbing", name: "Stair Climbing", symbol: "figure.stair.stepper",
      tint: .mint, activityType: .stairClimbing, locationType: .indoor,
      group: .stationary),
    WatchSport(
      id: "tennis", name: "Tennis", symbol: "figure.tennis", tint: .yellow,
      activityType: .tennis, locationType: .outdoor, group: .ball),
    WatchSport(
      id: "basketball", name: "Basketball", symbol: "figure.basketball", tint: .orange,
      activityType: .basketball, locationType: .indoor, group: .ball),
    WatchSport(
      id: "football", name: "Football", symbol: "figure.soccer", tint: .green,
      activityType: .soccer, locationType: .outdoor, group: .ball),
    WatchSport(
      id: "yoga", name: "Yoga", symbol: "figure.yoga", tint: .purple,
      activityType: .yoga, locationType: .indoor, group: .studio),
    WatchSport(
      id: "pilates", name: "Pilates", symbol: "figure.pilates", tint: .pink,
      activityType: .pilates, locationType: .indoor, group: .studio),
    WatchSport(
      id: "dancing", name: "Dancing", symbol: "figure.dance", tint: .pink,
      activityType: .cardioDance, locationType: .indoor, group: .studio),
    WatchSport(
      id: "boxing", name: "Boxing", symbol: "figure.boxing", tint: .red,
      activityType: .boxing, locationType: .indoor, group: .studio),
    WatchSport(
      id: "strength-training", name: "Strength", symbol: "figure.strengthtraining.traditional",
      tint: .blue, activityType: .traditionalStrengthTraining,
      locationType: .indoor, group: .strength),
    WatchSport(
      id: "crossfit", name: "CrossFit", symbol: "figure.cross.training", tint: .indigo,
      activityType: .crossTraining, locationType: .indoor, group: .strength),
    WatchSport(
      id: "hiit", name: "HIIT", symbol: "figure.highintensity.intervaltraining",
      tint: .red, activityType: .highIntensityIntervalTraining,
      locationType: .indoor, group: .strength),
  ]

  static func sport(id: String?) -> WatchSport? {
    guard let id else { return nil }
    return all.first { $0.id == id }
  }

  /// What a message names when it carries only the recording profile — an
  /// older phone build, or a session whose sport is not in the catalogue.
  static func fallback(recording: String?) -> WatchSport {
    switch recording {
    case "ride": return sport(id: "cycling") ?? all[0]
    default: return sport(id: "running") ?? all[0]
    }
  }

  static func sports(in group: WatchSportGroup) -> [WatchSport] {
    all.filter { $0.group == group }
  }
}
