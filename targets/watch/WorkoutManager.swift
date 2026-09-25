import Foundation
import Combine
import HealthKit
import WatchConnectivity
import WatchKit

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
  /// Phone launch identity in epoch ms, echoed in the running acknowledgement.
  /// New sessions count down locally after waking, so launch latency cannot
  /// consume the countdown before the watch is visible.
  static let startAt = "startAt"
  static let state = "state"
}

enum WatchMessageKind {
  static let heartRate = "heartRate"
  static let workoutState = "workoutState"
  static let start = "start"
  static let stop = "stop"
}

/// Metadata the watch stamps on the HKWorkout it saves, read back by the
/// phone's HealthKit importer. Duplicated by hand from
/// src/services/healthkit/writebackMappers.ts, for the same reason the message
/// keys above are: a watchOS target cannot import from the React Native side.
enum WatchWorkoutMetadataKey {
  /// Apple's own key for a workout's display name — the Health app renders it
  /// in place of the activity type, and so does the importer. Without it a
  /// CrossFit session reaches the diary as "Cross Training", because the only
  /// thing that crosses into HealthKit is the numeric activity type and
  /// `.crossTraining` is Apple's name for it, not the one the wearer picked.
  static let brandName = "HKWorkoutBrandName"
  /// Which side started the session. See `WatchWorkoutOrigin`.
  static let origin = "QlaFitWatchOrigin"
}

enum WatchWorkoutOrigin {
  /// The phone started this session and its own recorder is saving it to the
  /// diary, so the importer must skip this copy or the effort is logged twice.
  static let phone = "phone"
  /// Started on the watch, phone uninvolved. The HealthKit import is the only
  /// way this session ever reaches the diary, so it must not be skipped.
  static let watch = "watch"
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
  static let shared = WorkoutManager()
  @Published private(set) var dashboard: [String: Any] =
    UserDefaults.standard.dictionary(forKey: "phoneDashboard") ?? [:]
  @Published private(set) var phoneMetrics: [String: Any] = [:]
  @Published private(set) var startedAt = Date()
  @Published private(set) var activeCalories: Double = 0
  @Published private(set) var distance: Double = 0
  @Published private(set) var averageHeartRate: Double = 0
  @Published private(set) var maxHeartRate: Double = 0
  @Published private(set) var heartRateAt = Date.distantPast
  @Published private(set) var isFinishing = false
  @Published private(set) var isPaused = false
  var isPhoneWorkout: Bool { origin == WatchWorkoutOrigin.phone }
  @Published private(set) var heartRate: Double = 0
  @Published private(set) var isRunning = false
  @Published private(set) var sport: WatchSport = WatchSportCatalogue.all[0]
  @Published private(set) var lastError: String?
  /// Seconds left before the session is considered under way, or nil when
  /// nothing is counting down. Cosmetic: the workout session and the heart
  /// rate stream open immediately, so nothing is lost during the count.
  @Published private(set) var countdown: Int?

  private var countdownTask: Task<Void, Never>?

  /// Which side started the session now running, stamped onto the saved
  /// workout so the phone's importer knows whether the diary already has it.
  /// Defaults to `watch`: a session whose origin we somehow lost is better
  /// imported (and, at worst, deduplicated by hand) than silently dropped.
  private var origin: String = WatchWorkoutOrigin.watch

  private let healthStore = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  private var phoneWorkoutRequested = false
  private var requestInFlight = false
  private var acceptedStartAt: Double?
  private var lastPhoneCommandAt: Double = 0
  private var launchConfirmationTask: Task<Void, Never>?

  override init() {
    super.init()
    activateConnectivity()
  }

  // MARK: - WatchConnectivity

  /// Confirm only after the phone has persisted the goal. An unreachable phone
  /// leaves the editor open for retry instead of claiming an unsynced save.
  func saveNutrientGoal(key: String, value: Double, completion: @escaping (Bool) -> Void) {
    let connection = WCSession.default
    guard connection.activationState == .activated, connection.isReachable else {
      completion(false)
      return
    }
    connection.sendMessage(["kind": "setNutrientGoal", "key": key, "value": value], replyHandler: { reply in
      Task { @MainActor in
        let success = reply["success"] as? Bool == true
        if success, var nutrients = self.dashboard["nutrients"] as? [[String: Any]],
          let index = nutrients.firstIndex(where: { $0["key"] as? String == key }) {
          nutrients[index]["goal"] = value
          self.dashboard["nutrients"] = nutrients
          UserDefaults.standard.set(self.dashboard, forKey: "phoneDashboard")
        }
        completion(success)
      }
    }, errorHandler: { _ in
      Task { @MainActor in completion(false) }
    })
  }

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
      guard !Self.isUnreachable(error) else { return }
      Task { @MainActor in self?.lastError = error.localizedDescription }
    }
  }

  /// Reachability can drop between the isReachable check and delivery (the
  /// phone locks or suspends the app). That is the same "phone not there" case
  /// the guard already handles silently, not a failure worth showing on the
  /// wrist — reachability changes re-send state and retry pending requests.
  nonisolated private static func isUnreachable(_ error: Error) -> Bool {
    (error as? WCError)?.code == .notReachable
  }

  private func sendState() {
    send([
      "watchName": WKInterfaceDevice.current().name,
      WatchMessageKey.kind: WatchMessageKind.workoutState,
      WatchMessageKey.state: isRunning && (session?.state == .running || session?.state == .paused) ? "running" : "stopped",
      WatchMessageKey.startAt: acceptedStartAt ?? -1,
      // The profile, which is what the phone keys its own state on; the
      // catalogue id rides along for anything that wants the real sport.
      WatchMessageKey.sport: sport.activityType == .cycling ? "ride" : "run",
      WatchMessageKey.sportId: sport.id,
      WatchMessageKey.timestamp: Date().timeIntervalSince1970 * 1000,
    ])
  }

  func startFromPhoneLaunch(_ configuration: HKWorkoutConfiguration) {
    if !isRunning && !isFinishing {
      let sport = WatchSportCatalogue.all.first {
        $0.activityType == configuration.activityType && $0.locationType == configuration.locationType
      } ?? WatchSportCatalogue.fallback(recording: configuration.activityType == .cycling ? "ride" : "run")
      acceptedStartAt = nil
      start(sport: sport, countingDownTo: Date().addingTimeInterval(WatchCountdown.seconds),
        origin: WatchWorkoutOrigin.phone, launchConfiguration: configuration)
      launchConfirmationTask?.cancel()
      launchConfirmationTask = Task { [weak self] in
        try? await Task.sleep(nanoseconds: 30_000_000_000)
        guard !Task.isCancelled, let self, self.acceptedStartAt == nil else { return }
        self.stop()
      }
    }
    requestPhoneWorkout()
  }

  func requestPhoneWorkout() {
    phoneWorkoutRequested = true
    let connection = WCSession.default
    guard connection.activationState == .activated, connection.isReachable,
      !requestInFlight else { return }
    requestInFlight = true
    connection.sendMessage(["kind": "requestWorkout"], replyHandler: { [weak self] message in
      Task { @MainActor in
        guard let self else { return }
        self.requestInFlight = false
        self.phoneWorkoutRequested = false
        await self.handlePhoneMessage(message)
      }
    }, errorHandler: { [weak self] error in
      Task { @MainActor in
        self?.requestInFlight = false
        // phoneWorkoutRequested stays set, so the next reachability change retries.
        guard !Self.isUnreachable(error) else { return }
        self?.lastError = error.localizedDescription
      }
    })
  }

  private func receiveDashboard(_ context: [String: Any]) {
    guard let value = context["dashboard"] as? [String: Any] else { return }
    guard (value["updatedAt"] as? Double ?? 0) >= (dashboard["updatedAt"] as? Double ?? 0) else { return }
    dashboard = value
    UserDefaults.standard.set(value, forKey: "phoneDashboard")
  }

  private func handlePhoneMessage(_ message: [String: Any]) async {
    switch message["kind"] as? String {
    case "start":
      let requestedAt = message["requestedAt"] as? Double ?? 0
      guard requestedAt >= lastPhoneCommandAt else { return }
      lastPhoneCommandAt = requestedAt
      let startValue = message["startAt"] as? Double
      if isFinishing {
        // Re-read the live command after the previous builder finishes saving.
        phoneWorkoutRequested = true
        return
      }
      if isRunning {
        // The OS may already have started this session before connectivity woke.
        if isPhoneWorkout && acceptedStartAt == nil {
          let requestedSport = WatchSportCatalogue.sport(id: message["sportId"] as? String)
            ?? WatchSportCatalogue.fallback(recording: message["sport"] as? String)
          guard requestedSport.activityType == sport.activityType else { return }
          sport = requestedSport
          acceptedStartAt = startValue
          launchConfirmationTask?.cancel()
          // The HealthKit launch already began the full countdown. Adopting
          // its command must neither erase it with a past date nor restart it.
        }
        sendState()
        return
      }
      if let startValue, startValue == acceptedStartAt { return }
      await requestAuthorization()
      guard lastPhoneCommandAt == requestedAt else { return }
      let sport = WatchSportCatalogue.sport(id: message["sportId"] as? String)
        ?? WatchSportCatalogue.fallback(recording: message["sport"] as? String)
      // Waking the watch and granting Health permissions may take longer than
      // the phone's timestamp. A NEW workout still gets its full 3-2-1.
      start(sport: sport, countingDownTo: Date().addingTimeInterval(WatchCountdown.seconds),
        origin: WatchWorkoutOrigin.phone)
      if isRunning { acceptedStartAt = startValue }
      sendState()
      if let metrics = message["metrics"] as? [String: Any] {
        await handlePhoneMessage(["kind": "metrics", "metrics": metrics])
      }
    case "stop":
      let requestedAt = message["requestedAt"] as? Double ?? 0
      guard requestedAt >= lastPhoneCommandAt else { return }
      lastPhoneCommandAt = requestedAt
      if isPhoneWorkout { stop() }
    case "metrics":
      guard isRunning, isPhoneWorkout, let value = message["metrics"] as? [String: Any],
        let timestamp = value["timestamp"] as? Double,
        timestamp >= (phoneMetrics["timestamp"] as? Double ?? 0),
        let start = value["startedAt"] as? Double,
        abs(start - (acceptedStartAt ?? start)) < 120_000,
        phoneMetrics["sessionId"] == nil || phoneMetrics["sessionId"] as? String == value["sessionId"] as? String else { return }
      phoneMetrics = value
      let paused = value["phase"] as? String == "paused"
      if paused != isPaused {
        isPaused = paused
        if paused { session?.pause() } else { session?.resume() }
      }
      if value["phase"] as? String == "finished" { stop() }
    default: break
    }
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
  func start(
    sport: WatchSport,
    countingDownTo startAt: Date? = nil,
    origin: String = WatchWorkoutOrigin.watch,
    launchConfiguration: HKWorkoutConfiguration? = nil
  ) {
    guard !isRunning, !isFinishing, session == nil else { return }
    self.sport = sport
    self.origin = origin
    phoneMetrics = [:]
    activeCalories = 0
    distance = 0
    heartRate = 0
    averageHeartRate = 0
    maxHeartRate = 0
    heartRateAt = .distantPast
    isPaused = false
    lastError = nil

    let configuration = launchConfiguration ?? HKWorkoutConfiguration()
    if launchConfiguration == nil {
      configuration.activityType = sport.activityType
      configuration.locationType = sport.locationType
    }

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
      startedAt = startDate
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
    guard !isRunning, !isFinishing else { return }
    acceptedStartAt = nil
    start(
      sport: sport,
      countingDownTo: Date().addingTimeInterval(WatchCountdown.seconds))
  }

  func stop() {
    launchConfirmationTask?.cancel()
    guard isRunning, let session else { return }
    countdownTask?.cancel()
    countdownTask = nil
    countdown = nil
    isFinishing = true
    session.end()
    isRunning = false
    heartRate = 0
    sendState()
  }

  /// Ends collection and saves the workout so the run also lands in Apple
  /// Health, then tears down. Called once the session reports .ended.
  ///
  /// The metadata is how the saved workout identifies itself to the phone's
  /// importer: the brand name carries the sport the wearer actually picked,
  /// and the origin says whether the phone is already saving this session to
  /// the diary itself. A failed metadata write is logged but not fatal — the
  /// workout is still worth saving, it just reaches the diary under Apple's
  /// name for its activity type.
  private func finish() {
    guard let builder else { return }
    // Read off the main actor here and carried into the completions as plain
    // strings: a [String: Any] is not Sendable, and building the dictionary
    // inside the closure keeps it from crossing an isolation boundary.
    let brandName = sport.name
    let workoutOrigin = origin
    builder.endCollection(withEnd: Date()) { [weak self] _, error in
      if let error {
        Task { @MainActor in
          guard self?.builder === builder else { return }
          self?.lastError = error.localizedDescription
          self?.session = nil
          self?.builder = nil
          self?.isFinishing = false
          if self?.phoneWorkoutRequested == true { self?.requestPhoneWorkout() }
        }
        return
      }
      let metadata: [String: Any] = [
        WatchWorkoutMetadataKey.brandName: brandName,
        WatchWorkoutMetadataKey.origin: workoutOrigin,
      ]
      builder.addMetadata(metadata) { _, metadataError in
        if let metadataError {
          Task { @MainActor in
            self?.lastError = metadataError.localizedDescription
          }
        }
        builder.finishWorkout { _, error in
          Task { @MainActor in
            guard self?.builder === builder else { return }
            if let error { self?.lastError = error.localizedDescription }
            self?.session = nil
            self?.builder = nil
            self?.isFinishing = false
            if self?.phoneWorkoutRequested == true { self?.requestPhoneWorkout() }
          }
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
      guard self.session === workoutSession else { return }
      switch toState {
      case .running:
        guard !isFinishing else { return }
        isRunning = true
        sendState()
      case .ended:
        isFinishing = true
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
      guard session === workoutSession else { return }
      countdownTask?.cancel()
      countdownTask = nil
      countdown = nil
      lastError = error.localizedDescription
      isRunning = false
      isFinishing = false
      acceptedStartAt = nil
      session = nil
      builder = nil
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
    for identifier in [HKQuantityTypeIdentifier.activeEnergyBurned, .distanceWalkingRunning, .distanceCycling] {
      guard let type = HKQuantityType.quantityType(forIdentifier: identifier),
        collectedTypes.contains(type),
        let quantity = workoutBuilder.statistics(for: type)?.sumQuantity() else { continue }
      let isEnergy = identifier == .activeEnergyBurned
      let value = quantity.doubleValue(for: isEnergy ? .kilocalorie() : .meter())
      guard value.isFinite, value >= 0 else { continue }
      Task { @MainActor in
        guard self.builder === workoutBuilder, isRunning else { return }
        if isEnergy { activeCalories = value } else { distance = value }
      }
    }
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
    let average = statistics.averageQuantity()?.doubleValue(for: unit) ?? bpm
    let maximum = statistics.maximumQuantity()?.doubleValue(for: unit) ?? bpm

    Task { @MainActor in
      guard self.builder === workoutBuilder, isRunning else { return }
      heartRate = bpm
      heartRateAt = sampleDate
      averageHeartRate = average
      maxHeartRate = maximum
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
    Task { @MainActor in
      if let error { self.lastError = error.localizedDescription }
      receiveDashboard(session.receivedApplicationContext)
      try? session.updateApplicationContext(["watchName": WKInterfaceDevice.current().name])
      if phoneWorkoutRequested { requestPhoneWorkout() }
    }
  }

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    Task { @MainActor in receiveDashboard(applicationContext) }
  }

  nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
    Task { @MainActor in
      try? session.updateApplicationContext(["watchName": WKInterfaceDevice.current().name])
      if phoneWorkoutRequested { requestPhoneWorkout() }
      sendState()
    }
  }

  /// The phone drives start/stop so a run can begin from qla.fit without
  /// touching the watch, provided the watch app is running or the system wakes
  /// it for the message.
  nonisolated func session(
    _ session: WCSession, didReceiveMessage message: [String: Any]
  ) {
    Task { @MainActor in
      await handlePhoneMessage(message)
    }
  }
}
