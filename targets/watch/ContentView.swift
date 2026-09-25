import SwiftUI

/// Home opens first, with activities on the next page. A phone-started session
/// mirrors the phone recorder; standalone sessions use HealthKit statistics.
struct ContentView: View {
  @EnvironmentObject private var workoutManager: WorkoutManager
  @State private var homePage = 0

  var body: some View {
    Group {
      if let countdown = workoutManager.countdown {
        CountdownView(value: countdown, sport: workoutManager.sport)
      } else if workoutManager.isRunning {
        WatchActiveView()
      } else if workoutManager.isFinishing {
        ProgressView(watchText("workout.saving", "Saving workout…"))
      } else {
        TabView(selection: $homePage) {
          WatchNutritionView().tag(-1)
          WatchDashboardView().tag(0)
          SportListView().tag(1)
          WatchMeasurementView(kind: .water).tag(2)
          WatchMeasurementView(kind: .weight).tag(3)
        }
        .tabViewStyle(.page)
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
                  .disabled(workoutManager.isFinishing)
              }
            }
          }
        }
        Section {
          ErrorNote()
        }
      }
      .listStyle(.carousel)
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
struct ErrorNote: View {
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
