import SwiftUI

/// Mirrors the phone's full macro-ring catalogue, totals, goals and palette.
struct WatchNutritionView: View {
  @EnvironmentObject private var manager: WorkoutManager
  @State private var editingNutrient: String?
  private var nutrients: [[String: Any]] { manager.dashboard["nutrients"] as? [[String: Any]] ?? [] }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: 14) {
          if nutrients.isEmpty {
            Text(watchText("home.empty", "Open the phone dashboard to sync your daily activity."))
              .font(.footnote).foregroundStyle(.secondary)
          } else {
            // Two rings per row keeps the phone's ring/icon/value style legible on the wrist.
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
              ForEach(nutrients.indices, id: \.self) { index in
                nutrientRing(nutrients[index])
              }
            }
            VStack(spacing: 2) {
              Text(watchText("home.lastSynced", "Last synced from phone"))
              Text(Date(timeIntervalSince1970: (manager.dashboard["updatedAt"] as? Double ?? 0) / 1000),
                format: .dateTime.month().day().hour().minute())
            }.font(.caption2).foregroundStyle(.secondary)
          }
        }.padding(.horizontal, 4).padding(.bottom, 20)
      }
      .sheet(isPresented: Binding(get: { editingNutrient != nil }, set: { if !$0 { editingNutrient = nil } })) {
        if let nutrient = nutrients.first(where: { $0["key"] as? String == editingNutrient }) {
          WatchNutrientGoalEditor(nutrient: nutrient)
        }
      }
    }
  }

  private func nutrientRing(_ nutrient: [String: Any]) -> some View {
    let consumed = nutrient["consumed"] as? Double ?? 0
    let goal = nutrient["goal"] as? Double ?? 0
    let unit = nutrient["unit"] as? String ?? ""
    let key = nutrient["key"] as? String ?? ""
    let argb = (nutrient["color"] as? NSNumber)?.uint32Value ?? 0xffffffff
    let color = Color(red: Double((argb >> 16) & 255) / 255,
      green: Double((argb >> 8) & 255) / 255, blue: Double(argb & 255) / 255)

    return Button { editingNutrient = key } label: {
      VStack(spacing: 5) {
      Image(systemName: symbol(for: key)).foregroundStyle(color).accessibilityHidden(true)
      ZStack {
        Circle().stroke(color.opacity(0.18), lineWidth: 5)
        Circle().trim(from: 0, to: goal > 0 ? min(max(consumed / goal, 0), 1) : 0)
          .stroke(color, style: StrokeStyle(lineWidth: 5, lineCap: .round))
          .rotationEffect(.degrees(-90))
        VStack(spacing: 0) {
          Text(watchNumber(consumed, digits: 1)).font(.system(size: 17, weight: .semibold, design: .rounded))
            .monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
          Text(unit).font(.system(size: 9)).foregroundStyle(.secondary)
        }.padding(7)
      }.frame(width: 62, height: 62)
      Text(nutrient["label"] as? String ?? "").font(.caption2).foregroundStyle(color)
        .lineLimit(2).multilineTextAlignment(.center).frame(height: 30)
      if goal > 0 {
        Text(watchNumber(max(0, goal - consumed), digits: 1) + " " + unit + " " + watchText("nutrition.left", "left"))
          .font(.system(size: 10)).foregroundStyle(.secondary)
          .lineLimit(1).minimumScaleFactor(0.7).frame(height: 14)
        Text(watchText("nutrition.goal", "Goal") + ": " + watchNumber(goal, digits: 1) + " " + unit)
          .font(.system(size: 9)).foregroundStyle(.secondary)
          .lineLimit(1).minimumScaleFactor(0.7).frame(height: 12)
      } else {
        Text(watchText("nutrition.addGoal", "Add Goal"))
          .font(.system(size: 10)).foregroundStyle(color)
          .lineLimit(1).minimumScaleFactor(0.7).frame(height: 14)
        Color.clear.frame(height: 12).accessibilityHidden(true)
      }
      }.frame(maxWidth: .infinity).contentShape(Rectangle())
    }.buttonStyle(.plain)
  }

  private func symbol(for key: String) -> String {
    switch key {
    case "protein": return "fish.fill"
    case "carbs": return "carrot.fill"
    case "dietary_fiber": return "leaf.fill"
    case "sugars": return "cube.fill"
    case "fat", "saturated_fat", "monounsaturated_fat", "polyunsaturated_fat", "trans_fat": return "drop.fill"
    case "cholesterol": return "heart.fill"
    case "calcium": return "mug.fill"
    case "vitamin_a", "vitamin_c": return "sun.max.fill"
    default: return "circle.hexagongrid.fill"
    }
  }
}

private struct WatchNutrientGoalEditor: View {
  let nutrient: [String: Any]
  @EnvironmentObject private var manager: WorkoutManager
  @Environment(\.dismiss) private var dismiss
  @State private var value: Double = 2
  @State private var saving = false
  @State private var failed = false

  var body: some View {
    ScrollView {
      VStack(spacing: 12) {
        Text(nutrient["label"] as? String ?? "").font(.headline)
        Text(watchNumber(value, digits: 1) + " " + (nutrient["unit"] as? String ?? ""))
          .font(.title2).monospacedDigit()
        HStack {
          Button { value = max(step, value - step) } label: { Image(systemName: "minus") }
            .accessibilityLabel(watchText("nutrition.decreaseGoal", "Decrease goal"))
          Button { value = min(maximum, value + step) } label: { Image(systemName: "plus") }
            .accessibilityLabel(watchText("nutrition.increaseGoal", "Increase goal"))
        }.disabled(saving)
        Text(watchText("nutrition.goalHelp", "New goals apply from today onward."))
          .font(.caption2).foregroundStyle(.secondary)
        if failed {
          Text(watchText("nutrition.goalSaveFailed", "Could not save. Open qla.fit on your iPhone and try again."))
            .font(.caption2).foregroundStyle(.red)
        }
        Button(watchText("nutrition.saveGoal", "Save Goal")) {
          saving = true
          failed = false
          manager.saveNutrientGoal(key: nutrient["key"] as? String ?? "", value: value) { success in
            saving = false
            if success { dismiss() } else { failed = true }
          }
        }.disabled(saving)
        if saving { ProgressView() }
      }.padding()
    }
    .onAppear { value = max(step, nutrient["goal"] as? Double ?? 0) }
  }

  private var step: Double { nutrient["goalStep"] as? Double ?? 2 }
  private var maximum: Double { nutrient["goalMaximum"] as? Double ?? Double.greatestFiniteMagnitude }
}
