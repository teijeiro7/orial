import AppIntents
import Foundation

private let APP_GROUP = "group.com.orial.app.widget"
private let BASELINE_KEY = "hydration_baseline"
private let QUEUE_KEY = "hydration_nfc_queue"

private func todayString() -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.timeZone = TimeZone.current
    return formatter.string(from: Date())
}

private func readMl(_ dict: [String: Any]) -> Int {
    (dict["ml"] as? NSNumber)?.intValue ?? 0
}

@available(iOS 16.0, *)
struct LogWaterIntent: AppIntent {
    static var title: LocalizedStringResource = "Registrar agua"
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Mililitros", default: 550)
    var milliliters: Int

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let suite = UserDefaults(suiteName: APP_GROUP)
        let today = todayString()

        // 1. Baseline del día (0 si el baseline guardado es de otro día)
        var baselineLiters = 0.0
        if let baselineData = suite?.data(forKey: BASELINE_KEY),
           let baseline = try? JSONSerialization.jsonObject(with: baselineData) as? [String: Any],
           let baselineDate = baseline["date"] as? String,
           baselineDate == today,
           let consumed = baseline["consumedLiters"] as? Double {
            baselineLiters = consumed
        }

        // 2. Cola pendiente de hoy
        var queue: [[String: Any]] = []
        if let queueData = suite?.data(forKey: QUEUE_KEY),
           let parsed = try? JSONSerialization.jsonObject(with: queueData) as? [[String: Any]] {
            queue = parsed
        }
        let pendingMlToday = queue
            .filter { ($0["date"] as? String) == today }
            .reduce(0) { $0 + readMl($1) }

        // 3. Nuevo total
        let newTotalLiters = baselineLiters + Double(pendingMlToday) / 1000.0 + Double(milliliters) / 1000.0

        // 4. Encolar esta entrada
        queue.append(["id": UUID().uuidString, "date": today, "ml": milliliters])
        if let queueData = try? JSONSerialization.data(withJSONObject: queue) {
            suite?.set(queueData, forKey: QUEUE_KEY)
        }

        let formattedTotal = String(format: "%.1f", newTotalLiters)
        return .result(dialog: "💧 +\(milliliters)ml · hoy \(formattedTotal)L")
    }
}

@available(iOS 16.0, *)
struct OrialWaterShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogWaterIntent(),
            phrases: ["Registrar agua en \(.applicationName)"],
            shortTitle: "Registrar agua",
            systemImageName: "drop.fill"
        )
    }
}
