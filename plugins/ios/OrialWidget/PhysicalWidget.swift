import WidgetKit
import SwiftUI

struct PhysicalEntry: TimelineEntry {
  let date: Date
  let data: PhysicalWidgetData?
}

struct PhysicalProvider: TimelineProvider {
  func placeholder(in context: Context) -> PhysicalEntry {
    PhysicalEntry(date: Date(), data: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (PhysicalEntry) -> Void) {
    let entry = PhysicalEntry(date: Date(), data: readPhysicalWidgetData())
    completion(entry)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<PhysicalEntry>) -> Void) {
    let entry = PhysicalEntry(date: Date(), data: readPhysicalWidgetData())
    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
    let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
    completion(timeline)
  }
}

struct PhysicalWidget: Widget {
  let kind: String = "com.orial.app.widget.physical"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: PhysicalProvider()) { entry in
      PhysicalWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Physical")
    .description("Hydration progress, supplements, and weight prediction.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct PhysicalWidgetEntryView: View {
  var entry: PhysicalProvider.Entry

  var body: some View {
    Group {
      if let data = entry.data {
        PhysicalContentView(data: data)
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

struct PhysicalContentView: View {
  let data: PhysicalWidgetData
  @Environment(\.widgetFamily) var family

  var body: some View {
    Group {
      switch family {
      case .systemSmall:
        physicalSmallLayout
      default:
        physicalMediumLayout
      }
    }
    .widgetURL(physicalURL)
  }

  private var physicalURL: URL {
    URL(string: "orial://")!
  }

  // MARK: - Small

  private var physicalSmallLayout: some View {
    VStack(spacing: 8) {
      hydrationRing
        .frame(width: 64, height: 64)
      supplementsBadge
    }
    .padding(12)
  }

  // MARK: - Medium

  private var physicalMediumLayout: some View {
    HStack(spacing: 16) {
      VStack(alignment: .leading, spacing: 10) {
        hydrationBarSection
        supplementsSection
      }
      Spacer(minLength: 0)
      VStack(alignment: .trailing, spacing: 4) {
        Text("\(Int(data.hydrationPercentage))%")
          .font(.largeTitle.weight(.bold))
          .foregroundColor(.cyanLight)
        Text("hydrated")
          .font(.caption2)
          .foregroundColor(.textSecondary)
      }
    }
    .padding(16)
  }

  // MARK: - Ring

  private var hydrationRing: some View {
    ZStack {
      Circle()
        .stroke(Color.surfaceElevated, lineWidth: 6)
      Circle()
        .trim(from: 0, to: min(data.hydrationPercentage / 100, 1))
        .stroke(Color.cyanAccent, style: StrokeStyle(lineWidth: 6, lineCap: .round))
        .rotationEffect(.degrees(-90))
      VStack(spacing: 0) {
        Text("\(Int(data.hydrationPercentage))%")
          .font(.caption.weight(.bold))
          .foregroundColor(.textPrimary)
        Text("H₂O")
          .font(.system(size: 8))
          .foregroundColor(.textSecondary)
      }
    }
  }

  // MARK: - Hydration Bar

  private var hydrationBarSection: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("Hydration")
        .font(.caption2)
        .foregroundColor(.textSecondary)
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          RoundedRectangle(cornerRadius: 3)
            .fill(Color.surfaceElevated)
            .frame(height: 8)
          RoundedRectangle(cornerRadius: 3)
            .fill(
              LinearGradient(
                colors: [.cyanAccent, .cyanLight],
                startPoint: .leading,
                endPoint: .trailing
              )
            )
            .frame(width: geo.size.width * min(data.hydrationPercentage / 100, 1), height: 8)
        }
      }
      .frame(height: 8)
      Text("\(String(format: "%.1f", data.hydrationCurrent)) / \(String(format: "%.1f", data.hydrationTarget)) L")
        .font(.caption2)
        .foregroundColor(.textPrimary)
    }
  }

  // MARK: - Supplements

  private var supplementsSection: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("Supplements")
        .font(.caption2)
        .foregroundColor(.textSecondary)
      let pending = data.supplementsPending
      let total = data.supplementsTotal
      HStack(spacing: 4) {
        Image(systemName: "pills.fill")
          .font(.caption2)
          .foregroundColor(.violetLight)
        Text(pending == 0 ? "All done" : "\(total - pending)/\(total) taken")
          .font(.caption.weight(.semibold))
          .foregroundColor(pending == 0 ? .successGreen : .textPrimary)
      }
    }
  }

  // MARK: - Supplements badge (small)

  private var supplementsBadge: some View {
    HStack(spacing: 3) {
      Image(systemName: "pills.fill")
        .font(.system(size: 8))
        .foregroundColor(.violetLight)
      let pending = data.supplementsPending
      let total = data.supplementsTotal
      Text(pending == 0 ? "✓" : "\(total - pending)/\(total)")
        .font(.caption2.weight(.semibold))
        .foregroundColor(pending == 0 ? .successGreen : .textPrimary)
    }
    .padding(.horizontal, 6)
    .padding(.vertical, 2)
    .background(Color.surfaceElevated.opacity(0.6))
    .cornerRadius(4)
  }
}
