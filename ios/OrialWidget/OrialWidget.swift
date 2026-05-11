import WidgetKit
import SwiftUI

struct OrialWidgetEntry: TimelineEntry {
    let date: Date
    let completedCount: Int
    let totalCount: Int
    let habits: [WidgetHabit]
    let streakCount: Int
}

struct WidgetHabit: Codable {
    let id: String
    let name: String
    let emoji: String
    let completed: Bool
    let category: String
}

struct Provider: TimelineProvider {
    let userDefaults = UserDefaults(suiteName: "group.com.orial.app.widget")
    
    func placeholder(in context: Context) -> OrialWidgetEntry {
        OrialWidgetEntry(
            date: Date(),
            completedCount: 3,
            totalCount: 5,
            habits: [
                WidgetHabit(id: "1", name: "Meditate", emoji: "🧘", completed: true, category: "mind"),
                WidgetHabit(id: "2", name: "Read", emoji: "📖", completed: false, category: "learning"),
            ],
            streakCount: 5
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (OrialWidgetEntry) -> ()) {
        let entry = loadWidgetData()
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<OrialWidgetEntry>) -> ()) {
        let entry = loadWidgetData()
        let timeline = Timeline(entries: [entry], policy: .atEnd)
        completion(timeline)
    }
    
    private func loadWidgetData() -> OrialWidgetEntry {
        guard let dataString = userDefaults?.string(forKey: "widget_data"),
              let data = dataString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return placeholder(in: Context())
        }
        
        let completedCount = json["completedCount"] as? Int ?? 0
        let totalCount = json["totalCount"] as? Int ?? 0
        let streakCount = json["streakCount"] as? Int ?? 0
        
        var habits: [WidgetHabit] = []
        if let habitsArray = json["habits"] as? [[String: Any]] {
            habits = habitsArray.compactMap { habitDict in
                guard let id = habitDict["id"] as? String,
                      let name = habitDict["name"] as? String,
                      let emoji = habitDict["emoji"] as? String else { return nil }
                return WidgetHabit(
                    id: id,
                    name: name,
                    emoji: emoji,
                    completed: habitDict["completed"] as? Bool ?? false,
                    category: habitDict["category"] as? String ?? "other"
                )
            }
        }
        
        return OrialWidgetEntry(
            date: Date(),
            completedCount: completedCount,
            totalCount: totalCount,
            habits: habits,
            streakCount: streakCount
        )
    }
}

struct OrialWidgetEntryView : View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        case .systemLarge:
            LargeWidgetView(entry: entry)
        default:
            SmallWidgetView(entry: entry)
        }
    }
}

struct SmallWidgetView: View {
    let entry: OrialWidgetEntry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Orial")
                .font(.caption)
                .foregroundColor(.gray)
            
            Text("\(entry.completedCount)/\(entry.totalCount)")
                .font(.title)
                .bold()
            
            Text("Habits Done")
                .font(.caption2)
            
            if entry.streakCount > 0 {
                Label("\(entry.streakCount)", systemImage: "flame.fill")
                    .font(.caption2)
                    .foregroundColor(.orange)
            }
            
            Spacer()
            
            HStack {
                ForEach(entry.habits.prefix(3), id: \.id) { habit in
                    Text(habit.emoji)
                        .opacity(habit.completed ? 1.0 : 0.4)
                }
            }
        }
        .padding()
        .containerBackground(.widgetBackground, for: .widget)
    }
}

struct MediumWidgetView: View {
    let entry: OrialWidgetEntry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Orial")
                    .font(.headline)
                Spacer()
                if entry.streakCount > 0 {
                    Label("\(entry.streakCount)", systemImage: "flame.fill")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
            }
            
            Text("\(entry.completedCount) of \(entry.totalCount) habits done")
                .font(.subheadline)
            
            HStack(spacing: 12) {
                ForEach(entry.habits.prefix(5), id: \.id) { habit in
                    VStack {
                        Text(habit.emoji)
                            .font(.title2)
                            .opacity(habit.completed ? 1.0 : 0.3)
                        Text(habit.name)
                            .font(.caption2)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding()
        .containerBackground(.widgetBackground, for: .widget)
    }
}

struct LargeWidgetView: View {
    let entry: OrialWidgetEntry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Orial")
                    .font(.title2)
                    .bold()
                Spacer()
                if entry.streakCount > 0 {
                    Label("\(entry.streakCount) day streak", systemImage: "flame.fill")
                        .font(.subheadline)
                        .foregroundColor(.orange)
                }
            }
            
            ProgressView(value: Double(entry.completedCount), total: Double(max(entry.totalCount, 1)))
                .tint(Color.purple)
            
            Text("\(entry.completedCount) of \(entry.totalCount) habits completed")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 60))], spacing: 12) {
                ForEach(entry.habits, id: \.id) { habit in
                    VStack {
                        ZStack {
                            Circle()
                                .fill(habit.completed ? Color.green.opacity(0.2) : Color.gray.opacity(0.1))
                                .frame(width: 50, height: 50)
                            
                            Text(habit.emoji)
                                .font(.title2)
                                .opacity(habit.completed ? 1.0 : 0.4)
                            
                            if habit.completed {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                    .offset(x: 15, y: 15)
                            }
                        }
                        
                        Text(habit.name)
                            .font(.caption)
                            .lineLimit(1)
                    }
                }
            }
            
            Spacer()
        }
        .padding()
        .containerBackground(.widgetBackground, for: .widget)
    }
}

@main
struct OrialWidget: Widget {
    let kind: String = "OrialWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            OrialWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Orial Habits")
        .description("Track your daily habits from your home screen.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
