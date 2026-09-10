import Foundation
import HealthKit
import WatchConnectivity

/// Sport identifiers cross the WatchConnectivity boundary as plain strings, so
/// these raw values must stay identical to the RecordingSport union in
/// src/services/recording/types.ts.
enum WatchSport: String {
  case run
  case ride

  var activityType: HKWorkoutActivityType {
    switch self {
    case .run: return .running
    case .ride: return .cycling
    }
  }
}

/// Message keys shared with the phone. Duplicated by hand in the phone-side
/// WatchConnectivity module because a watchOS target cannot import from the iOS
/// module, the same way the Live Activity layout duplicates its intent targets.
enum WatchMessageKey {
  static let kind = "kind"
  static let heartRate = "bpm"
  static let timestamp = "t"
  static let sport = "sport"
  static let state = "state"
}

enum WatchMessageKind {
  static let heartRate = "heartRate"
  static let workoutState = "workoutState"
  static let start = "start"
  static let stop = "stop"
}

/// Owns the watch-side workout session and streams heart rate to the phone.
///
/// HKLiveWorkoutBuilder is the only way to get beat-to-beat heart rate on
/// watchOS: it delivers samples as the sensor produces them, rather than when
/// HealthKit later syncs them to the paired phone (which is batched and can lag
/// by minutes). Everything here therefore hangs off an active workout session --
/// without one there is no live stream to forward.
@MainActor
final class WorkoutManager: NSObject, ObservableObject {
  @Published private(set) var heartRate: Double = 0
  @Published private(set) var isRunning = false
  @Published private(set) var sport: WatchSport = .run
  @Published private(set) var lastError: String?

  private let healthStore = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?

  override init() {
    super.init()
    activateConnectivity()
  }

  // MARK: - WatchConnectivity

  private func activateConnectivity() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  /// Live values use sendMessage when the phone is reachable and are dropped
  /// otherwise. They are deliberately not queued with transferUserInfo: a heart
  /// rate is only useful while it is current, and a backlog delivered minutes
  /// later would be replayed onto the wrong part of the route.
  private func send(_ payload: [String: Any]) {
    let session = WCSession.default
    guard session.activationState == .activated, session.isReachable else { return }
    session.sendMessage(payload, replyHandler: nil) { [weak self] error in
      Task { @MainActor in self?.lastError = error.localizedDescription }
    }
  }

  private func sendState() {
    send([
      WatchMessageKey.kind: WatchMessageKind.workoutState,
      WatchMessageKey.state: isRunning ? "running" : "stopped",
      WatchMessageKey.sport: sport.rawValue,
      WatchMessageKey.timestamp: Date().timeIntervalSince1970 * 1000,
    ])
  }

  // MARK: - Authorization

  func requestAuthorization() async {
    guard HKHealthStore.isHealthDataAvailable() else {
      lastError = "Health data is unavailable on this device."
      return
    }
    let share: Set<HKSampleType> = [HKQuantityType.workoutType()]
    var read: Set<HKObjectType> = [HKQuantityType.workoutType()]
    for identifier in [
      HKQuantityTypeIdentifier.heartRate,
      .activeEnergyBurned,
      .distanceWalkingRunning,
      .distanceCycling,
    ] {
      if let type = HKQuantityType.quantityType(forIdentifier: identifier) {
        read.insert(type)
      }
    }
    do {
      try await healthStore.requestAuthorization(toShare: share, read: read)
    } catch {
      lastError = error.localizedDescription
    }
  }

  // MARK: - Session lifecycle

  func start(sport: WatchSport) {
    guard !isRunning else { return }
    self.sport = sport

    let configuration = HKWorkoutConfiguration()
    configuration.activityType = sport.activityType
    configuration.locationType = .outdoor

    do {
      let session = try HKWorkoutSession(
        healthStore: healthStore, configuration: configuration)
      let builder = session.associatedWorkoutBuilder()
      builder.dataSource = HKLiveWorkoutDataSource(
        healthStore: healthStore, workoutConfiguration: configuration)

      session.delegate = self
      builder.delegate = self

      self.session = session
      self.builder = builder

      let startDate = Date()
      session.startActivity(with: startDate)
      builder.beginCollection(withStart: startDate) { [weak self] _, error in
        guard let error else { return }
        Task { @MainActor in self?.lastError = error.localizedDescription }
      }

      isRunning = true
      sendState()
    } catch {
      lastError = error.localizedDescription
    }
  }

  func stop() {
    guard isRunning, let session else { return }
    session.end()
    isRunning = false
    heartRate = 0
    sendState()
  }

  /// Ends collection and saves the workout so the run also lands in Apple
  /// Health, then tears down. Called once the session reports .ended.
  private func finish() {
    guard let builder else { return }
    builder.endCollection(withEnd: Date()) { [weak self] _, error in
      if let error {
        Task { @MainActor in self?.lastError = error.localizedDescription }
        return
      }
      builder.finishWorkout { [weak self] _, error in
        Task { @MainActor in
          if let error { self?.lastError = error.localizedDescription }
          self?.session = nil
          self?.builder = nil
        }
      }
    }
  }
}

// MARK: - HKWorkoutSessionDelegate

extension WorkoutManager: HKWorkoutSessionDelegate {
  nonisolated func workoutSession(
    _ workoutSession: HKWorkoutSession,
    didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState,
    date: Date
  ) {
    Task { @MainActor in
      switch toState {
      case .running:
        isRunning = true
        sendState()
      case .ended:
        isRunning = false
        sendState()
        finish()
      default:
        break
      }
    }
  }

  nonisolated func workoutSession(
    _ workoutSession: HKWorkoutSession, didFailWithError error: Error
  ) {
    Task { @MainActor in
      lastError = error.localizedDescription
      isRunning = false
      sendState()
    }
  }
}

// MARK: - HKLiveWorkoutBuilderDelegate

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
  nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

  nonisolated func workoutBuilder(
    _ workoutBuilder: HKLiveWorkoutBuilder,
    didCollectDataOf collectedTypes: Set<HKSampleType>
  ) {
    guard
      let heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate),
      collectedTypes.contains(heartRateType),
      let statistics = workoutBuilder.statistics(for: heartRateType),
      // mostRecentQuantity is the latest beat rather than the session average,
      // which is what a live readout needs.
      let quantity = statistics.mostRecentQuantity()
    else { return }

    let unit = HKUnit.count().unitDivided(by: .minute())
    let bpm = quantity.doubleValue(for: unit)
    guard bpm.isFinite, bpm > 0 else { return }

    let sampleDate = statistics.mostRecentQuantityDateInterval()?.end ?? Date()

    Task { @MainActor in
      heartRate = bpm
      send([
        WatchMessageKey.kind: WatchMessageKind.heartRate,
        WatchMessageKey.heartRate: bpm,
        WatchMessageKey.timestamp: sampleDate.timeIntervalSince1970 * 1000,
      ])
    }
  }
}

// MARK: - WCSessionDelegate

extension WorkoutManager: WCSessionDelegate {
  nonisolated func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    guard let error else { return }
    Task { @MainActor in self.lastError = error.localizedDescription }
  }

  /// The phone drives start/stop so a run can begin from qla.fit without
  /// touching the watch, provided the watch app is running or the system wakes
  /// it for the message.
  nonisolated func session(
    _ session: WCSession, didReceiveMessage message: [String: Any]
  ) {
    Task { @MainActor in
      switch message[WatchMessageKey.kind] as? String {
      case WatchMessageKind.start:
        let raw = message[WatchMessageKey.sport] as? String ?? WatchSport.run.rawValue
        start(sport: WatchSport(rawValue: raw) ?? .run)
      case WatchMessageKind.stop:
        stop()
      default:
        break
      }
    }
  }
}
