import SwiftUI

/// Mirrors the phone's full macro-ring catalogue, totals, goals and palette.
struct WatchNutritionView: View {
  @EnvironmentObject private var manager: WorkoutManager
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

    return VStack(spacing: 5) {
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
        .multilineTextAlignment(.center)
      if goal > 0 {
        Text(watchNumber(max(0, goal - consumed), digits: 1) + " " + unit + " " + watchText("nutrition.left", "left"))
          .font(.system(size: 10)).foregroundStyle(.secondary)
        Text(watchText("nutrition.goal", "Goal") + ": " + watchNumber(goal, digits: 1) + " " + unit)
          .font(.system(size: 9)).foregroundStyle(.secondary)
      }
    }.frame(maxWidth: .infinity).accessibilityElement(children: .combine)
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
