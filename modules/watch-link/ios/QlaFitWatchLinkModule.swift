import ExpoModulesCore
import WatchConnectivity

/// Message keys shared with the watch app. Duplicated by hand from
/// targets/watch/WorkoutManager.swift because a watchOS target and an iOS pod
/// cannot import from each other, the same way the Live Activity layout
/// duplicates its intent target strings.
private enum WatchMessageKey {
  static let kind = "kind"
  static let heartRate = "bpm"
  static let timestamp = "t"
  static let sport = "sport"
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

  var isReachable: Bool {
    guard WCSession.isSupported() else { return false }
    return WCSession.default.isReachable
  }

  var isWatchAppInstalled: Bool {
    guard WCSession.isSupported() else { return false }
    return WCSession.default.isWatchAppInstalled
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  /// Commands are best-effort: the watch app has to be reachable to act on
  /// them. Queuing with transferUserInfo would start a workout minutes after
  /// the user asked for one, which is worse than not starting it at all.
  func send(kind: String, sport: String?) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated, session.isReachable else { return }
    var payload: [String: Any] = [WatchMessageKey.kind: kind]
    if let sport { payload[WatchMessageKey.sport] = sport }
    session.sendMessage(payload, replyHandler: nil, errorHandler: nil)
  }

  private func emitReachability() {
    onEvent?("onReachabilityChange", ["isReachable": isReachable])
  }

  fileprivate func handle(message: [String: Any]) {
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
    default:
      break
    }
  }

  fileprivate func reachabilityDidChange() {
    emitReachability()
  }
}

extension WatchLink: WCSessionDelegate {
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    reachabilityDidChange()
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    handle(message: message)
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    reachabilityDidChange()
  }

  // Required on iOS so the session can be handed to a newly paired watch.
  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    WCSession.default.activate()
  }
}

public final class QlaFitWatchLinkModule: Module {
  private let link = WatchLink()

  public func definition() -> ModuleDefinition {
    Name("QlaFitWatchLink")

    Events("onHeartRate", "onWorkoutState", "onReachabilityChange")

    OnCreate {
      self.link.onEvent = { [weak self] name, body in
        self?.sendEvent(name, body)
      }
      self.link.activate()
    }

    Property("isSupported") { WCSession.isSupported() }

    Property("isReachable") { self.link.isReachable }

    Property("isWatchAppInstalled") { self.link.isWatchAppInstalled }

    AsyncFunction("startWorkout") { (sport: String) in
      self.link.send(kind: WatchMessageKind.start, sport: sport)
    }

    AsyncFunction("stopWorkout") {
      self.link.send(kind: WatchMessageKind.stop, sport: nil)
    }
  }
}
