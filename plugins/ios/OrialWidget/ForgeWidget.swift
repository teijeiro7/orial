import WidgetKit
import SwiftUI

struct ForgeEntry: TimelineEntry {
  let date: Date
  let data: ForgeWidgetData?
}

struct ForgeProvider: TimelineProvider {
  func placeholder(in context: Context) -> ForgeEntry {
    ForgeEntry(date: Date(), data: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (ForgeEntry) -> Void) {
    let entry = ForgeEntry(date: Date(), data: readForgeWidgetData())
    completion(entry)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ForgeEntry>) -> Void) {
    let entry = ForgeEntry(date: Date(), data: readForgeWidgetData())
    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
    let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
    completion(timeline)
  }
}

struct ForgeWidget: Widget {
  let kind: String = "com.orial.app.widget.forge"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ForgeProvider()) { entry in
      ForgeWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Forge")
    .description("Steps, strain, recovery, and weight at a glance.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct ForgeWidgetEntryView: View {
  var entry: ForgeProvider.Entry

  var body: some View {
    Group {
      if let data = entry.data {
        ForgeContentView(data: data)
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

struct ForgeContentView: View {
  let data: ForgeWidgetData
  @Environment(\.widgetFamily) var family

  var body: some View {
    Group {
      switch family {
      case .systemSmall:
        forgeSmallLayout
      default:
        forgeMediumLayout
      }
    }
    .widgetURL(forgeURL)
  }

  private var forgeURL: URL {
    URL(string: "orial://forge")!
  }

  // MARK: - Small

  private var forgeSmallLayout: some View {
    VStack(alignment: .leading, spacing: 6) {
      stepsRow
      Spacer(minLength: 0)
      HStack(alignment: .center, spacing: 12) {
        strainBadge
        recoveryDot
      }
    }
    .padding(12)
  }

  // MARK: - Medium

  private var forgeMediumLayout: some View {
    HStack(spacing: 16) {
      VStack(alignment: .leading, spacing: 8) {
        stepsRow
        weightRow
      }
      Spacer(minLength: 0)
      VStack(alignment: .trailing, spacing: 8) {
        strainBadge
        recoveryDot
      }
    }
    .padding(16)
  }

  // MARK: - Subviews

  private var stepsRow: some View {
    VStack(alignment: .leading, spacing: 1) {
      Text("\(data.steps)")
        .font(.system(.title2, design: .rounded).weight(.bold))
        .foregroundColor(.textPrimary)
      Text("steps today")
        .font(.caption2)
        .foregroundColor(.textSecondary)
    }
  }

  private var weightRow: some View {
    HStack(spacing: 4) {
      if let w = data.weight {
        Text("\(String(format: "%.1f", w)) kg")
          .font(.subheadline.weight(.semibold))
          .foregroundColor(.cyanLight)
      }
    }
  }

  private var strainBadge: some View {
    HStack(spacing: 4) {
      Text("\(data.strain ?? 0)")
        .font(.headline.weight(.bold))
        .foregroundColor(strainColor)
      Text("strain")
        .font(.caption2)
        .foregroundColor(.textSecondary)
    }
  }

  private var recoveryDot: some View {
    HStack(spacing: 4) {
      Circle()
        .fill(recoveryColor)
        .frame(width: 8, height: 8)
      if let score = data.recoveryScore {
        Text("\(score)%")
          .font(.subheadline.weight(.semibold))
          .foregroundColor(recoveryColor)
      }
      Text("recovery")
        .font(.caption2)
        .foregroundColor(.textSecondary)
    }
  }

  // MARK: - Colors

  private var strainColor: Color {
    guard let s = data.strain else { return .textSecondary }
    switch s {
    case 0..<8:  return .successGreen
    case 8..<14: return .warningOrange
    default:     return .errorRed
    }
  }

  private var recoveryColor: Color {
    guard let r = data.recoveryScore else { return .textSecondary }
    switch r {
    case 0..<33:  return .errorRed
    case 33..<66: return .warningOrange
    default:      return .successGreen
    }
  }
}
