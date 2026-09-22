import Foundation
import HealthKit
import WatchConnectivity

/// Message keys shared with the phone. Duplicated by hand in the phone-side
/// WatchConnectivity module because a watchOS target cannot import from the iOS
/// module, the same way the Live Activity layout duplicates its intent targets.
enum WatchMessageKey {
  static let kind = "kind"
  static let heartRate = "bpm"
  static let timestamp = "t"
  /// The recording profile — "run" or "ride" — which is all an older phone
  /// build sends and all the phone needs back in a state message.
  static let sport = "sport"
  /// The catalogue id ("stair-climbing"), so the watch can open the session
  /// as what it actually is rather than as one of two profiles.
  static let sportId = "sportId"
  /// When the phone considers the session to have started, in epoch ms. The
  /// watch counts down to it; a message that arrives after it is already past
  /// skips the countdown rather than delaying a session that is under way.
  static let startAt = "startAt"
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
  @Published private(set) var sport: WatchSport = WatchSportCatalogue.all[0]
  @Published private(set) var lastError: String?
  /// Seconds left before the session is considered under way, or nil when
  /// nothing is counting down. Cosmetic: the workout session and the heart
  /// rate stream open immediately, so nothing is lost during the count.
  @Published private(set) var countdown: Int?

  private var countdownTask: Task<Void, Never>?

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
      // The profile, which is what the phone keys its own state on; the
      // catalogue id rides along for anything that wants the real sport.
      WatchMessageKey.sport: sport.activityType == .cycling ? "ride" : "run",
      WatchMessageKey.sportId: sport.id,
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

  /// Starts a session for a sport. `countingDownTo` runs the 3-2-1 overlay:
  /// the session itself opens straight away either way, so the count never
  /// costs the wearer any of their workout.
  func start(sport: WatchSport, countingDownTo startAt: Date? = nil) {
    guard !isRunning else { return }
    self.sport = sport

    let configuration = HKWorkoutConfiguration()
    configuration.activityType = sport.activityType
    configuration.locationType = sport.locationType

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
      beginCountdown(to: startAt)
      sendState()
    } catch {
      lastError = error.localizedDescription
    }
  }

  /// Ticks the overlay down to zero. A start that is already in the past — a
  /// message delivered late, or the watch waking to receive it — shows no
  /// count at all rather than a stale one.
  private func beginCountdown(to startAt: Date?) {
    countdownTask?.cancel()
    countdownTask = nil
    guard let startAt else {
      countdown = nil
      return
    }
    let remaining = Int(ceil(startAt.timeIntervalSinceNow))
    guard remaining > 0 else {
      countdown = nil
      return
    }
    let capped = min(remaining, Int(WatchCountdown.seconds))
    countdown = capped
    countdownTask = Task { [weak self] in
      var value = capped
      while value > 0 {
        try? await Task.sleep(nanoseconds: 1_000_000_000)
        if Task.isCancelled { return }
        value -= 1
        await MainActor.run { self?.countdown = value > 0 ? value : nil }
      }
    }
  }

  /// Started from the watch itself: the wearer is looking at it, so the same
  /// three seconds apply before the live view replaces the list.
  func startFromWatch(sport: WatchSport) {
    start(
      sport: sport,
      countingDownTo: Date().addingTimeInterval(WatchCountdown.seconds))
  }

  func stop() {
    guard isRunning, let session else { return }
    countdownTask?.cancel()
    countdownTask = nil
    countdown = nil
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
        let sport =
          WatchSportCatalogue.sport(id: message[WatchMessageKey.sportId] as? String)
          ?? WatchSportCatalogue.fallback(
            recording: message[WatchMessageKey.sport] as? String)
        let startAt = (message[WatchMessageKey.startAt] as? Double)
          .map { Date(timeIntervalSince1970: $0 / 1000) }
        start(sport: sport, countingDownTo: startAt)
      case WatchMessageKind.stop:
        stop()
      default:
        break
      }
    }
  }
}
