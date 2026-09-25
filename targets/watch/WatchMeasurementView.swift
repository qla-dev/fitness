import SwiftUI
import WatchKit

enum WatchMeasurementKind {
  case water, weight
  var key: String { self == .water ? "water" : "weight" }
  var title: String { self == .water ? watchText("home.water", "Water") : watchText("measurement.weight", "Weight") }
  var symbol: String { self == .water ? "drop.fill" : "scalemass.fill" }
  var color: Color { self == .water ? .blue : .green }
}

struct WatchMeasurementView: View {
  let kind: WatchMeasurementKind
  @EnvironmentObject private var manager: WorkoutManager
  @State private var editing = false

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: 14) {
          Image(systemName: kind.symbol).font(.system(size: 40)).foregroundStyle(kind.color)
          Text(kind.title).font(.headline)
          Text(currentValue).font(.title2).monospacedDigit()
          if let updatedAt = manager.dashboard["updatedAt"] as? Double {
            VStack {
              Text(watchText("home.lastSynced", "Last synced from phone"))
              Text(Date(timeIntervalSince1970: updatedAt / 1000), format: .dateTime.month().day().hour().minute())
            }.font(.caption2).foregroundStyle(.secondary)
          }
          Button(watchText("measurement.add", "Add entry")) { editing = true }
            .buttonStyle(.borderedProminent).tint(kind.color)
          Text(watchText("measurement.phone", "Saves to qla.fit on your iPhone."))
            .font(.caption2).foregroundStyle(.secondary)
        }.padding(.horizontal, 6).padding(.bottom, 20)
      }
      .sheet(isPresented: $editing) { WatchMeasurementEditor(kind: kind) }
    }
  }

  private var currentValue: String {
    if kind == .water {
      return watchNumber(manager.dashboard["water"] as? Double ?? 0) + " " + watchText("unit.ml", "ml")
    }
    guard let kg = manager.dashboard["weight"] as? Double, kg > 0 else { return "—" }
    let pounds = manager.dashboard["weightUnit"] as? String == "lbs"
    return watchNumber(pounds ? kg * 2.2046226218 : kg, digits: 1) + " " +
      (pounds ? watchText("unit.lbs", "lb") : watchText("unit.kg", "kg"))
  }
}

private struct WatchMeasurementEditor: View {
  let kind: WatchMeasurementKind
  @EnvironmentObject private var manager: WorkoutManager
  @Environment(\.dismiss) private var dismiss
  @State private var value = 0
  @State private var saving = false
  @State private var pending: (id: String, value: Double, date: String)?
  @State private var unconfirmed = false
  private var pounds: Bool { manager.dashboard["weightUnit"] as? String == "lbs" }

  var body: some View {
    ScrollView {
      VStack(spacing: 10) {
        Text(kind.title).font(.headline)
        if kind == .water {
          Picker(kind.title, selection: $value) {
            ForEach(1..<81, id: \.self) { step in
              Text(watchNumber(Double(step) * 25) + " " + unit).tag(step)
            }
          }.pickerStyle(.wheel).frame(height: 90).disabled(saving || pending != nil)
        } else {
          HStack {
            Picker(kind.title, selection: Binding(get: { value / 10 }, set: { value = $0 * 10 + value % 10 })) {
              ForEach(1..<(pounds ? 661 : 300), id: \.self) { whole in Text(watchNumber(Double(whole))).tag(whole) }
            }
            Picker(watchText("measurement.decimal", "Decimal"), selection: Binding(get: { value % 10 }, set: { value = value / 10 * 10 + $0 })) {
              ForEach(0..<10, id: \.self) { fraction in Text(watchNumber(Double(fraction) / 10, digits: 1)).tag(fraction) }
            }
            Text(unit).font(.caption2)
          }.pickerStyle(.wheel).frame(height: 90).disabled(saving || pending != nil)
        }
        if unconfirmed {
          Text(watchText("measurement.unconfirmed", "Open qla.fit on iPhone, then tap Retry to confirm this entry."))
            .font(.caption2).foregroundStyle(.secondary)
        }
        Button(unconfirmed ? watchText("common.retry", "Retry") : watchText("common.save", "Save")) { save() }
          .disabled(saving)
        if saving { ProgressView() }
      }.padding(.horizontal, 8)
    }
    .interactiveDismissDisabled(saving)
    .onAppear {
      if let entry = UserDefaults.standard.dictionary(forKey: pendingKey),
        let id = entry["id"] as? String, let amount = entry["value"] as? Double, let date = entry["date"] as? String {
        pending = (id, amount, date)
        value = Int((kind == .water ? amount / 25 : amount * (pounds ? 2.2046226218 : 1) * 10).rounded())
        unconfirmed = true
        return
      }
      if kind == .water { value = 10 }
      else {
        let kg = manager.dashboard["weight"] as? Double ?? 70
        value = min(pounds ? 6609 : 2999, max(10, Int((kg * (pounds ? 2.2046226218 : 1) * 10).rounded())))
      }
    }
  }

  private var unit: String {
    kind == .water ? watchText("unit.ml", "ml") :
      (pounds ? watchText("unit.lbs", "lb") : watchText("unit.kg", "kg"))
  }
  private var pendingKey: String { "pendingMeasurement-" + kind.key }

  private func save() {
    guard !saving else { return }
    if pending == nil {
      let formatter = DateFormatter()
      formatter.calendar = Calendar(identifier: .gregorian)
      formatter.locale = Locale(identifier: "en_US_POSIX")
      formatter.dateFormat = "yyyy-MM-dd"
      let amount = kind == .water ? Double(value) * 25 : Double(value) / 10 / (pounds ? 2.2046226218 : 1)
      pending = (UUID().uuidString, amount, formatter.string(from: Date()))
    }
    guard let entry = pending else { return }
    UserDefaults.standard.set(["id": entry.id, "value": entry.value, "date": entry.date], forKey: pendingKey)
    saving = true
    manager.saveMeasurement(id: entry.id, kind: kind.key, value: entry.value, date: entry.date) { success in
      saving = false
      if success { UserDefaults.standard.removeObject(forKey: pendingKey); pending = nil; WKInterfaceDevice.current().play(.success); dismiss() }
      else { unconfirmed = true }
    }
  }
}
