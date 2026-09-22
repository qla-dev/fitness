import SwiftUI

/// The watch app: pick a sport, or watch the one the phone started.
///
/// It is still not a second recorder — distance, pace and the route stay on
/// the phone, which owns GPS and the saved activity. What it does own is the
/// workout session that keeps the heart-rate sensor streaming, and the choice
/// of which sport that session is, so a wearer who starts from the wrist gets
/// the same list the phone offers rather than two of its eighteen entries.
struct ContentView: View {
  @EnvironmentObject private var workoutManager: WorkoutManager

  var body: some View {
    Group {
      if let countdown = workoutManager.countdown {
        CountdownView(value: countdown, sport: workoutManager.sport)
      } else if workoutManager.isRunning {
        ActiveView()
      } else {
        SportListView()
      }
    }
  }
}

/// The 3-2-1 before the live view. The session is already open behind it, so
/// this is a handover animation rather than a delay — it exists so the wrist
/// and the phone agree about when the effort started.
private struct CountdownView: View {
  let value: Int
  let sport: WatchSport

  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: sport.symbol)
        .font(.system(size: 26, weight: .semibold))
        .foregroundStyle(sport.tint)
      Text("\(value)")
        .font(.system(size: 64, weight: .bold, design: .rounded))
        .monospacedDigit()
        .contentTransition(.numericText(countsDown: true))
        .animation(.snappy, value: value)
      Text(sport.name.uppercased())
        .font(.caption2)
        .tracking(1.2)
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(
      RadialGradient(
        colors: [sport.tint.opacity(0.35), .clear],
        center: .center, startRadius: 4, endRadius: 110)
    )
  }
}

/// Live heart rate, with the sport it belongs to named above it.
private struct ActiveView: View {
  @EnvironmentObject private var workoutManager: WorkoutManager
  /// Drives the pulse behind the reading. Tied to the value rather than to a
  /// timer, so it beats when a beat arrives and is still when nothing does.
  @State private var pulse = false

  private var sport: WatchSport { workoutManager.sport }
  private var bpm: String {
    workoutManager.heartRate > 0
      ? String(format: "%.0f", workoutManager.heartRate) : "--"
  }

  var body: some View {
    VStack(spacing: 2) {
      Label(sport.name, systemImage: sport.symbol)
        .font(.caption2)
        .foregroundStyle(sport.tint)
        .labelStyle(.titleAndIcon)

      ZStack {
        Circle()
          .stroke(sport.tint.opacity(0.25), lineWidth: 3)
          .scaleEffect(pulse ? 1.06 : 0.94)
          .animation(.easeInOut(duration: 0.45), value: pulse)
        VStack(spacing: 0) {
          Text(bpm)
            .font(.system(size: 42, weight: .semibold, design: .rounded))
            .monospacedDigit()
            .contentTransition(.numericText())
          Text("BPM")
            .font(.system(size: 10, weight: .semibold))
            .tracking(1.4)
            .foregroundStyle(.secondary)
        }
      }
      .frame(height: 96)
      .onChange(of: workoutManager.heartRate) { _, _ in pulse.toggle() }

      Button(role: .destructive) {
        workoutManager.stop()
      } label: {
        Label("Stop", systemImage: "stop.fill").font(.footnote)
      }
      .buttonStyle(.borderedProminent)
      .tint(.red)

      ErrorNote()
    }
    .padding(.horizontal, 6)
  }
}

/// Every sport the phone offers, sectioned the way the phone sections them.
private struct SportListView: View {
  @EnvironmentObject private var workoutManager: WorkoutManager

  var body: some View {
    NavigationStack {
      List {
        ForEach(WatchSportGroup.allCases) { group in
          let sports = WatchSportCatalogue.sports(in: group)
          if !sports.isEmpty {
            Section(group.title) {
              ForEach(sports) { sport in
                SportRow(sport: sport) { workoutManager.startFromWatch(sport: sport) }
              }
            }
          }
        }
        Section {
          ErrorNote()
        }
      }
      .listStyle(.carousel)
      .navigationTitle("qla.fit")
    }
  }
}

/// One sport: its mark in its own colour, then its name. The tinted disc is
/// what makes the list scannable at a glance on a screen this size — eighteen
/// rows of plain text are not.
private struct SportRow: View {
  let sport: WatchSport
  let onStart: () -> Void

  var body: some View {
    Button(action: onStart) {
      HStack(spacing: 10) {
        ZStack {
          Circle()
            .fill(sport.tint.opacity(0.22))
            .frame(width: 30, height: 30)
          Image(systemName: sport.symbol)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(sport.tint)
        }
        Text(sport.name)
          .font(.body)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
        Spacer(minLength: 0)
      }
      .padding(.vertical, 2)
    }
    .buttonStyle(.plain)
  }
}

/// Shown wherever it happens: a failure to start is worth saying on the wrist,
/// because the phone cannot show it if the watch is the one that failed.
private struct ErrorNote: View {
  @EnvironmentObject private var workoutManager: WorkoutManager

  var body: some View {
    if let error = workoutManager.lastError {
      Text(error)
        .font(.footnote)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
    }
  }
}
