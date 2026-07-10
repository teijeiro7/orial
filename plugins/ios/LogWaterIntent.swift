import AppIntents
import Foundation

private let APP_GROUP = "group.com.orial.app.widget"
private let BASELINE_KEY = "hydration_baseline"
private let QUEUE_KEY = "hydration_nfc_queue"

private func todayString() -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.timeZone = TimeZone(identifier: "UTC")!
    return formatter.string(from: Date())
}

/// A single pending water entry logged via NFC while the app was backgrounded/closed,
/// waiting to be drained into the DB by the JS side. Tolerant of both `Int` and
/// `Double`-shaped JSON numbers for `ml` (NSNumber bridges either).
private struct QueueEntry {
    let id: String
    let date: String
    let ml: Int

    init(id: String, date: String, ml: Int) {
        self.id = id
        self.date = date
        self.ml = ml
    }

    init?(_ dict: [String: Any]) {
        guard let id = dict["id"] as? String, let date = dict["date"] as? String else { return nil }
        self.id = id
        self.date = date
        self.ml = (dict["ml"] as? NSNumber)?.intValue ?? 0
    }

    var asDictionary: [String: Any] { ["id": id, "date": date, "ml": ml] }
}

/// Today's baseline hydration total, written by the JS side (`writeHydrationBaseline`).
/// Uses NSNumber-tolerant parsing for `consumedLiters` since a whole-number liters
/// value (e.g. `1` or `0`) can serialize as a JSON number that fails a direct `as? Double` cast.
private struct Baseline {
    let date: String
    let consumedLiters: Double

    init?(_ dict: [String: Any]) {
        guard let date = dict["date"] as? String,
              let consumed = (dict["consumedLiters"] as? NSNumber)?.doubleValue else { return nil }
        self.date = date
        self.consumedLiters = consumed
    }
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

        // 1. Baseline del día (0 si el baseline guardado es de otro día, no existe,
        // o no tiene el formato esperado). Decode failures are logged but still
        // fall back gracefully to 0 -- that fallback is correct resilience, not a bug.
        var baselineLiters = 0.0
        if let baselineData = suite?.data(forKey: BASELINE_KEY) {
            do {
                let json = try JSONSerialization.jsonObject(with: baselineData)
                if let baseline = Baseline(json as? [String: Any] ?? [:]), baseline.date == today {
                    baselineLiters = baseline.consumedLiters
                }
            } catch {
                print("[LogWaterIntent] Failed to decode hydration baseline: \(error)")
            }
        }

        // 2. Cola pendiente de hoy. Same graceful fallback (empty queue) on decode
        // failure, just now visible in device logs.
        var rawQueue: [[String: Any]] = []
        if let queueData = suite?.data(forKey: QUEUE_KEY) {
            do {
                let json = try JSONSerialization.jsonObject(with: queueData)
                rawQueue = json as? [[String: Any]] ?? []
            } catch {
                print("[LogWaterIntent] Failed to decode hydration NFC queue: \(error)")
            }
        }
        // Entries that don't fit the expected shape are dropped, mirroring the same
        // validate-at-the-boundary approach used on the JS side of this queue.
        let queueEntries = rawQueue.compactMap { QueueEntry($0) }
        let pendingMlToday = queueEntries
            .filter { $0.date == today }
            .reduce(0) { $0 + $1.ml }

        // 3. Nuevo total
        let newTotalLiters = baselineLiters + Double(pendingMlToday) / 1000.0 + Double(milliliters) / 1000.0

        // 4. Encolar esta entrada. This write is the one thing that actually has to
        // succeed for the "+Xml" dialog to be honest -- if the app group is
        // unavailable or the encode fails, tell the user instead of showing a
        // success message for something that was never persisted.
        let newEntry = QueueEntry(id: UUID().uuidString, date: today, ml: milliliters)
        let updatedQueue = queueEntries + [newEntry]

        do {
            guard let suite = suite else {
                throw NSError(
                    domain: "LogWaterIntent",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "App group UserDefaults unavailable"]
                )
            }
            let queueData = try JSONSerialization.data(withJSONObject: updatedQueue.map { $0.asDictionary })
            suite.set(queueData, forKey: QUEUE_KEY)
        } catch {
            print("[LogWaterIntent] Failed to persist water queue entry: \(error)")
            return .result(dialog: "⚠️ No se pudo registrar el agua")
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
