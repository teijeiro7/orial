import WidgetKit
import SwiftUI

struct OverviewEntry: TimelineEntry {
  let date: Date
  let data: OverviewWidgetData?
}

struct OverviewProvider: TimelineProvider {
  func placeholder(in context: Context) -> OverviewEntry {
    OverviewEntry(date: Date(), data: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (OverviewEntry) -> Void) {
    let entry = OverviewEntry(date: Date(), data: readOverviewWidgetData())
    completion(entry)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<OverviewEntry>) -> Void) {
    let entry = OverviewEntry(date: Date(), data: readOverviewWidgetData())
    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
    let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
    completion(timeline)
  }
}

struct OverviewWidget: Widget {
  let kind: String = "com.orial.app.widget.overview"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: OverviewProvider()) { entry in
      OverviewWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Overview")
    .description("A snapshot of steps, hydration, tasks, net worth, and caffeine.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct OverviewWidgetEntryView: View {
  var entry: OverviewProvider.Entry

  var body: some View {
    Group {
      if let data = entry.data {
        OverviewContentView(data: data)
      } else {
        noDataView
      }
    }
    .widgetBackground()
  }

  private var noDataView: some View {
    Text("Open Orial to sync data")
      .font(.caption2)
      .foregroundColor(.textSecondary)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

struct OverviewContentView: View {
  let data: OverviewWidgetData
  @Environment(\.widgetFamily) var family

  var body: some View {
    Group {
      switch family {
      case .systemSmall:
        overviewSmallLayout
      default:
        overviewMediumLayout
      }
    }
    .widgetURL(URL(string: "orial://")!)
  }

  // MARK: - Small (2 headline metrics)

  private var overviewSmallLayout: some View {
    VStack(alignment: .leading, spacing: 10) {
      metricRow(value: "\(data.steps)", label: "steps", color: .textPrimary)
      metricRow(value: "\(Int(data.hydrationPercentage))%", label: "hydrated", color: .cyanLight)
      Spacer(minLength: 0)
      metricRow(value: "\(data.tasksDone)/\(data.tasksTotal)", label: "tasks", color: .violetLight)
    }
    .padding(12)
  }

  // MARK: - Medium (all 5 metrics)

  private var overviewMediumLayout: some View {
    HStack(spacing: 16) {
      VStack(alignment: .leading, spacing: 8) {
        metricRow(value: "\(data.steps)", label: "steps", color: .textPrimary)
        metricRow(value: "\(Int(data.hydrationPercentage))%", label: "hydrated", color: .cyanLight)
        metricRow(value: "\(data.tasksDone)/\(data.tasksTotal)", label: "tasks", color: .violetLight)
      }
      Spacer(minLength: 0)
      VStack(alignment: .trailing, spacing: 8) {
        if let netWorth = data.netWorth {
          metricRow(
            value: formattedNetWorth(netWorth),
            label: "net worth",
            color: .successGreen,
            alignment: .trailing
          )
        }
        metricRow(value: "\(data.caffeineMg) mg", label: "caffeine", color: .warningOrange, alignment: .trailing)
      }
    }
    .padding(16)
  }

  // MARK: - Subviews

  private func metricRow(
    value: String,
    label: String,
    color: Color,
    alignment: HorizontalAlignment = .leading
  ) -> some View {
    VStack(alignment: alignment, spacing: 1) {
      Text(value)
        .font(.subheadline.weight(.bold))
        .foregroundColor(color)
      Text(label)
        .font(.caption2)
        .foregroundColor(.textSecondary)
    }
  }

  private func formattedNetWorth(_ value: Double) -> String {
    let symbol = data.netWorthCurrency == "EUR" ? "€" : data.netWorthCurrency
    return "\(Int(value.rounded()))\(symbol)"
  }
}
