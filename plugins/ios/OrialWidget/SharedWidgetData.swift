import Foundation

private let APP_GROUP = "group.com.orial.app.widget"

struct ForgeWidgetData: Codable {
  let date: String
  let steps: Int
  let caloriesBurned: Int?
  let recoveryScore: Int?
  let strain: Int?
  let whoopConnected: Bool
  let weight: Double?
}

struct PhysicalWidgetData: Codable {
  let date: String
  let hydrationCurrent: Double
  let hydrationTarget: Double
  let hydrationPercentage: Double
  let supplementsPending: Int
  let supplementsTotal: Int
  let predictedWeight: Double?
  let weightRangeLow: Double?
  let weightRangeHigh: Double?
}

struct OverviewWidgetData: Codable {
  let date: String
  let steps: Int
  let hydrationPercentage: Double
  let tasksDone: Int
  let tasksTotal: Int
  let netWorth: Double?
  let netWorthCurrency: String
  let caffeineMg: Int
}

func readForgeWidgetData() -> ForgeWidgetData? {
  guard let suite = UserDefaults(suiteName: APP_GROUP),
        let raw = suite.string(forKey: "forge_widget_data"),
        let data = raw.data(using: .utf8)
  else { return nil }
  return try? JSONDecoder().decode(ForgeWidgetData.self, from: data)
}

func readPhysicalWidgetData() -> PhysicalWidgetData? {
  guard let suite = UserDefaults(suiteName: APP_GROUP),
        let raw = suite.string(forKey: "physical_widget_data"),
        let data = raw.data(using: .utf8)
  else { return nil }
  return try? JSONDecoder().decode(PhysicalWidgetData.self, from: data)
}

func readOverviewWidgetData() -> OverviewWidgetData? {
  guard let suite = UserDefaults(suiteName: APP_GROUP),
        let raw = suite.string(forKey: "overview_widget_data"),
        let data = raw.data(using: .utf8)
  else { return nil }
  return try? JSONDecoder().decode(OverviewWidgetData.self, from: data)
}
