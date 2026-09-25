import ExpoModulesCore
import WatchConnectivity
import HealthKit

/// Message keys shared with the watch app. Duplicated by hand from
/// targets/watch/WorkoutManager.swift because a watchOS target and an iOS pod
/// cannot import from each other, the same way the Live Activity layout
/// duplicates its intent target strings.
private enum WatchMessageKey {
  static let kind = "kind"
  static let heartRate = "bpm"
  static let timestamp = "t"
  static let sport = "sport"
  /// The catalogue id, so the watch opens the session as the sport it is
  /// rather than as one of the two recording profiles.
  static let sportId = "sportId"
  /// Epoch ms the session starts at; the watch counts down to it.
  static let startAt = "startAt"
  static let state = "state"
}

private enum WatchMessageKind {
  static let heartRate = "heartRate"
  static let workoutState = "workoutState"
  static let start = "start"
  static let stop = "stop"
}

/// Owns the phone side of the WCSession pair.
///
/// Kept separate from the Expo module so the delegate can be retained for the
/// process lifetime: WCSession holds its delegate weakly and delivers on a
/// background queue, so a delegate owned by a short-lived object would silently
/// stop receiving messages.
private final class WatchLink: NSObject {
  var onEvent: ((String, [String: Any]) -> Void)?
  private let healthStore = HKHealthStore()
  private var command: [String: Any]?
  private var startCompletion: ((Error?) -> Void)?
  private var dashboard: [String: Any]? = UserDefaults.standard.dictionary(forKey: "watchDashboard")
  private var metrics: [String: Any]?
  private var watchName: String? = UserDefaults.standard.string(forKey: "watchDeviceName")

  var deviceName: String? { isPaired ? watchName : nil }

  fileprivate func receiveIdentity(_ message: [String: Any]) {
    guard let name = message["watchName"] as? String, !name.isEmpty, name != watchName else { return }
    watchName = name
    UserDefaults.standard.set(name, forKey: "watchDeviceName")
    emitReachability()
  }
  private var goalReplies: [String: ([String: Any]) -> Void] = [:]

  func completeGoalRequest(id: String, success: Bool) {
    goalReplies.removeValue(forKey: id)?(["success": success])
  }

  func requestGoal(_ message: [String: Any], reply: @escaping ([String: Any]) -> Void) {
    guard let key = message["key"] as? String, let value = message["value"] as? Double,
      value.isFinite, value > 0 else { reply(["success": false]); return }
    let id = UUID().uuidString
    goalReplies[id] = reply
    onEvent?("onGoalRequest", ["id": id, "key": key, "value": value])
    DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in
      self?.completeGoalRequest(id: id, success: false)
    }
  }
  private var launchTimeout: DispatchWorkItem?
  private var launchAttempts = 0
  private var launchedAttempt = 0

  var isReachable: Bool {
    guard WCSession.isSupported() else { return false }
    return WCSession.default.isReachable
  }

  var isWatchAppInstalled: Bool {
    guard WCSession.isSupported() else { return false }
    return WCSession.default.isWatchAppInstalled
  }

  /// A watch is paired with this phone, whether or not our app is on it.
  /// Separate from `isWatchAppInstalled` so the phone can tell "no watch"
  /// apart from "a watch without our app", which are different things to say.
  var isPaired: Bool {
    guard WCSession.isSupported() else { return false }
    return WCSession.default.isPaired
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  // A launch completion is not confirmation of a running workout. Resolve only
  // after the watch acknowledges this request's startAt from HKWorkoutSession.
  func start(sport: String, sportId: String?, startAt: Double?, completion: @escaping (Error?) -> Void) {
    finishLaunch(error: launchError("Workout start was replaced."))
    command = ["kind": "start", "sport": sport, "sportId": sportId ?? "",
      "startAt": startAt ?? Date().timeIntervalSince1970 * 1000,
      "requestedAt": Date().timeIntervalSince1970 * 1000]
    launchAttempts = 0
    launchedAttempt = 0
    startCompletion = completion
    attemptLaunch()
  }

  private func launchError(_ message: String) -> NSError {
    NSError(domain: "QlaFitWatchLink", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }

  private func finishLaunch(error: Error?) {
    launchTimeout?.cancel()
    launchTimeout = nil
    let completion = startCompletion
    startCompletion = nil
    completion?(error)
  }

  private func attemptLaunch() {
    guard startCompletion != nil else { return }
    launchAttempts += 1
    let timeout = DispatchWorkItem { [weak self] in
      guard let self, self.startCompletion != nil else { return }
      if self.launchAttempts < 2 { self.attemptLaunch() }
      else {
        let error = self.launchError("Apple Watch did not confirm a running workout after two launch attempts.")
        self.finishLaunch(error: error)
        self.stop()
      }
    }
    launchTimeout?.cancel()
    launchTimeout = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + 12, execute: timeout)
    launchIfReady()
  }

  private func launchIfReady() {
    guard startCompletion != nil, WCSession.isSupported() else { return }
    guard launchedAttempt != launchAttempts else { return }
    launchedAttempt = launchAttempts
    let pending = currentCommand()
    guard pending["kind"] as? String == "start" else { return }
    sendPayload(pending)
    let configuration = HKWorkoutConfiguration()
    // Keep in sync with WatchSportCatalogue. The background launch must be
    // able to start the right HealthKit session without a connectivity round trip.
    let sports: [String: (HKWorkoutActivityType, HKWorkoutSessionLocationType)] = [
      "running": (.running, .outdoor), "cycling": (.cycling, .outdoor),
      "walking": (.walking, .outdoor), "hiking": (.hiking, .outdoor),
      "swimming": (.swimming, .indoor), "rowing": (.rowing, .indoor),
      "elliptical": (.elliptical, .indoor), "stair-climbing": (.stairClimbing, .indoor),
      "tennis": (.tennis, .outdoor), "basketball": (.basketball, .indoor),
      "football": (.soccer, .outdoor), "yoga": (.yoga, .indoor),
      "pilates": (.pilates, .indoor), "dancing": (.cardioDance, .indoor),
      "boxing": (.boxing, .indoor), "strength-training": (.traditionalStrengthTraining, .indoor),
      "crossfit": (.crossTraining, .indoor), "hiit": (.highIntensityIntervalTraining, .indoor),
    ]
    let selected = sports[pending["sportId"] as? String ?? ""]
    configuration.activityType = selected?.0 ?? (pending["sport"] as? String == "ride" ? .cycling : .running)
    configuration.locationType = selected?.1 ?? .outdoor
    // Do not gate the OS launch on isReachable or cached installation flags.
    // Those are not evidence that the closed watch app cannot be launched.
    NSLog("[Watch launch] Requesting HealthKit launch, attempt %d", launchAttempts)
    healthStore.startWatchApp(with: configuration) { success, error in
      NSLog("[Watch launch] HealthKit result: %@, %@", success ? "launched" : "failed", error?.localizedDescription ?? "no error")
    }
  }

  func updateDashboard(_ value: [String: Any]) {
    dashboard = value
    UserDefaults.standard.set(value, forKey: "watchDashboard")
    flushDashboard()
  }

  private func flushDashboard() {
    guard WCSession.isSupported(), WCSession.default.activationState == .activated,
      isWatchAppInstalled, let dashboard else { return }
    // Only the home snapshot is durable. Workout commands must never replay
    // from a background transfer long after the user ended the session.
    try? WCSession.default.updateApplicationContext(["dashboard": dashboard])
  }

  func updateMetrics(_ value: [String: Any]) {
    metrics = value
    sendPayload(["kind": "metrics", "metrics": value])
  }

  func stop() {
    let stopped: [String: Any] = ["kind": "stop", "requestedAt": Date().timeIntervalSince1970 * 1000]
    command = stopped
    metrics = nil
    finishLaunch(error: launchError("Workout start was cancelled."))
    sendPayload(stopped)
  }

  private func sendPayload(_ payload: [String: Any]) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated, session.isReachable else { return }
    session.sendMessage(payload, replyHandler: nil, errorHandler: nil)
  }

  private func emitReachability() {
    onEvent?("onReachabilityChange", ["isReachable": isReachable])
  }

  fileprivate func handle(message: [String: Any]) {
    receiveIdentity(message)
    switch message[WatchMessageKey.kind] as? String {
    case WatchMessageKind.heartRate:
      guard let bpm = message[WatchMessageKey.heartRate] as? Double else { return }
      let timestamp =
        message[WatchMessageKey.timestamp] as? Double ?? Date().timeIntervalSince1970 * 1000
      onEvent?("onHeartRate", ["bpm": bpm, "timestamp": timestamp])
    case WatchMessageKind.workoutState:
      let state = message[WatchMessageKey.state] as? String ?? "stopped"
      let sport = message[WatchMessageKey.sport] as? String ?? "run"
      onEvent?("onWorkoutState", ["state": state, "sport": sport])
      if state == "running", let startAt = message["startAt"] as? Double,
        startAt == (command?["startAt"] as? Double) {
        finishLaunch(error: nil)
      }
      if state == "running", let metrics {
        sendPayload(["kind": "metrics", "metrics": metrics])
      }
    default:
      break
    }
  }

  fileprivate func reachabilityDidChange() {
    emitReachability()
    launchIfReady()
    flushDashboard()
    let pending = currentCommand()
    if pending["kind"] as? String != "none" { sendPayload(pending) }
    if let metrics { sendPayload(["kind": "metrics", "metrics": metrics]) }
  }

  fileprivate func currentCommand() -> [String: Any] {
    guard let command else { return ["kind": "none"] }
    if command["kind"] as? String == "start" {
      let age = Date().timeIntervalSince1970 * 1000 - (command["requestedAt"] as? Double ?? 0)
      // Do not start an abandoned countdown if the watch reconnects much later.
      if age > 120_000 { return ["kind": "none"] }
    }
    var reply = command
    if let metrics { reply["metrics"] = metrics }
    return reply
  }
}

extension WatchLink: WCSessionDelegate {
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    DispatchQueue.main.async {
      self.receiveIdentity(session.receivedApplicationContext)
      self.reachabilityDidChange()
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    DispatchQueue.main.async { self.receiveIdentity(applicationContext) }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    DispatchQueue.main.async { self.handle(message: message) }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void) {
    DispatchQueue.main.async {
      if message["kind"] as? String == "setNutrientGoal" {
        self.requestGoal(message, reply: replyHandler)
        return
      }
      replyHandler(message["kind"] as? String == "requestWorkout" ? self.currentCommand() : [:])
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    DispatchQueue.main.async { self.reachabilityDidChange() }
  }

  // Required on iOS so the session can be handed to a newly paired watch.
  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    watchName = nil
    UserDefaults.standard.removeObject(forKey: "watchDeviceName")
    WCSession.default.activate()
  }
}

public final class QlaFitWatchLinkModule: Module {
  private let link = WatchLink()

  public func definition() -> ModuleDefinition {
    Name("QlaFitWatchLink")

    Events("onHeartRate", "onWorkoutState", "onReachabilityChange", "onGoalRequest")

    AsyncFunction("completeGoalRequest") { (id: String, success: Bool) in
      self.link.completeGoalRequest(id: id, success: success)
    }.runOnQueue(.main)

    OnCreate {
      self.link.onEvent = { [weak self] name, body in
        self?.sendEvent(name, body)
      }
      DispatchQueue.main.async { self.link.activate() }
    }

    Property("isSupported") { WCSession.isSupported() }

    Property("isReachable") { self.link.isReachable }

    Property("isWatchAppInstalled") { self.link.isWatchAppInstalled }

    Property("isPaired") { self.link.isPaired }
    Property("watchName") { self.link.deviceName }

    AsyncFunction("startWorkout") { (sport: String, sportId: String?, startAt: Double?, promise: Promise) in
      self.link.start(sport: sport, sportId: sportId, startAt: startAt) { error in
        if let error { promise.reject("WATCH_LAUNCH_FAILED", error.localizedDescription) }
        else { promise.resolve(nil) }
      }
    }.runOnQueue(.main)

    AsyncFunction("stopWorkout") {
      self.link.stop()
    }.runOnQueue(.main)

    AsyncFunction("updateDashboard") { (value: [String: Any]) in
      self.link.updateDashboard(value)
    }.runOnQueue(.main)

    AsyncFunction("updateMetrics") { (value: [String: Any]) in
      self.link.updateMetrics(value)
    }.runOnQueue(.main)
  }
}
