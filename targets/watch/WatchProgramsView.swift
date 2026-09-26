import Foundation
import SwiftUI

struct WatchProgramSnapshot: Codable, Sendable {
  let updatedAt: Double
  let programs: [WatchProgram]
}

struct WatchProgram: Codable, Identifiable, Sendable {
  let id: Int
  let name: String
  let expiresAt: String?
  let exercises: [Exercise]

  struct Exercise: Codable, Sendable {
    let name: String
    let sets: [SetTarget]
  }

  struct SetTarget: Codable, Sendable {
    let reps: Double?
    let weight: Double?
    let duration: Double?
    let distance: Double?
    let rest: Double?
    let notes: String?

    var prescription: String {
      var parts: [String] = []
      if let reps { parts.append(watchNumber(reps) + " " + watchText("program.reps", "reps")) }
      if let weight, weight > 0 { parts.append(watchNumber(weight, digits: 1) + " " + watchText("unit.kg", "kg")) }
      if let duration, duration > 0 { parts.append(watchClock(duration)) }
      if let distance, distance > 0 { parts.append(watchNumber(distance, digits: 2) + " " + watchText("unit.km", "km")) }
      return parts.joined(separator: " · ")
    }
  }

  var expired: Bool {
    guard let expiresAt else { return false }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let date = formatter.date(from: expiresAt) else { return true }
    return date <= Date()
  }

  var steps: [(name: String, number: Int, target: SetTarget)] {
    exercises.flatMap { exercise in
      exercise.sets.enumerated().map { (exercise.name, $0.offset + 1, $0.element) }
    }
  }
}

struct WatchProgramsView: View {
  @EnvironmentObject private var manager: WorkoutManager

  var body: some View {
    NavigationStack {
      List {
        if manager.programs.isEmpty {
          Text(watchText("program.empty", "Add programs on iPhone to sync them here."))
            .font(.footnote).foregroundStyle(.secondary)
        }
        ForEach(manager.programs) { program in
          NavigationLink {
            List {
              Text(program.name).font(.headline)
              Button(watchText("program.start", "Start program")) {
                manager.startProgram(program)
              }.disabled(program.expired || program.steps.isEmpty || manager.isFinishing)
              if program.expired {
                Text(watchText("program.expired", "This program has expired."))
              }
              ForEach(program.exercises.indices, id: \.self) { index in
                let exercise = program.exercises[index]
                Section(exercise.name) {
                  ForEach(exercise.sets.indices, id: \.self) { setIndex in
                    VStack(alignment: .leading) {
                      Text(watchText("program.set", "Set") + " " + watchNumber(Double(setIndex + 1)))
                      Text(exercise.sets[setIndex].prescription).font(.caption)
                      if let notes = exercise.sets[setIndex].notes {
                        Text(notes).font(.caption2).foregroundStyle(.secondary)
                      }
                    }
                  }
                }
              }
              ErrorNote()
            }
          } label: {
            Label(program.name, systemImage: "figure.strengthtraining.traditional")
          }
        }
      }
      .navigationTitle(watchText("program.title", "My Programs"))
    }
  }
}

struct WatchProgramActiveView: View {
  @EnvironmentObject private var manager: WorkoutManager

  var body: some View {
    if let program = manager.activeProgram {
      ScrollView {
        VStack(alignment: .leading, spacing: 10) {
          Text(program.name).font(.headline)
          if manager.programStep < program.steps.count {
            let step = program.steps[manager.programStep]
            Text(step.name).font(.title3)
            Text(watchText("program.set", "Set") + " " + watchNumber(Double(step.number)))
            Text(step.target.prescription).foregroundStyle(.yellow)
            if let notes = step.target.notes { Text(notes).font(.caption2) }
            if let until = manager.programRestUntil {
              TimelineView(.periodic(from: .now, by: 1)) { context in
                if until > context.date {
                  Text(watchText("program.rest", "Rest") + " " + watchClock(until.timeIntervalSince(context.date)))
                }
              }
            }
            Button(watchText("program.completeSet", "Complete set")) {
              manager.completeProgramSet()
            }.buttonStyle(.borderedProminent)
          } else {
            Text(watchText("program.complete", "All sets complete. Swipe to finish and save your workout."))
          }
        }.padding()
      }
    }
  }
}
