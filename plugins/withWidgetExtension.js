const path = require('path');
const fs = require('fs');
const xcode = require('xcode');
const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');

const APP_GROUP = 'group.com.orial.app.widget';
const WIDGET_TARGET_NAME = 'OrialWidgets';
const WIDGET_BUNDLE_ID = 'com.orial.app.widgets';

// ── Swift source files ────────────────────────────────────────────────────

const BUNDLE_SWIFT = `import WidgetKit
import SwiftUI

@main
struct OrialWidgetsBundle: WidgetBundle {
    var body: some Widget {
        HabitWidget()
        HydrationWidget()
        ForgeWidget()
    }
}
`;

const SHARED_DEFAULTS_SWIFT = `import Foundation

/// Centralised access to the App Group UserDefaults so all widgets share
/// the same keys as the main app's widgetService.ts.
enum SharedDefaults {
    static let groupId = "${APP_GROUP}"

    static let store: UserDefaults = {
        return UserDefaults(suiteName: groupId) ?? .standard
    }()

    static let widgetDataKey = "widget_data"
    static let forgeWidgetDataKey = "forge_widget_data"
    static let physicalWidgetDataKey = "physical_widget_data"
    static let habitQueueKey = "widget_habit_checkin_queue"
    static let hydrationQueueKey = "widget_hydration_delta_queue"

    static func readWidgetData() -> WidgetData? {
        guard let raw = store.string(forKey: widgetDataKey),
              let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetData.self, from: data)
    }

    static func readForgeData() -> ForgeWidgetDataModel? {
        guard let raw = store.string(forKey: forgeWidgetDataKey),
              let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(ForgeWidgetDataModel.self, from: data)
    }

    static func readPhysicalData() -> PhysicalWidgetDataModel? {
        guard let raw = store.string(forKey: physicalWidgetDataKey),
              let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(PhysicalWidgetDataModel.self, from: data)
    }
}

struct WidgetData: Codable {
    let date: String
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

struct ForgeWidgetDataModel: Codable {
    let date: String
    let steps: Int
    let caloriesBurned: Double?
    let recoveryScore: Int?
    let strain: Double?
    let whoopConnected: Bool
    let weight: Double?
}

struct PhysicalWidgetDataModel: Codable {
    let date: String
    let hydrationCurrent: Double
    let hydrationTarget: Double
    let hydrationPercentage: Double
    let supplementsPending: Int
    let supplementsTotal: Int
}
`;

const HABIT_WIDGET_SWIFT = `import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Timeline

struct HabitEntry: TimelineEntry {
    let date: Date
    let data: WidgetData?
}

struct HabitProvider: TimelineProvider {
    func placeholder(in context: Context) -> HabitEntry {
        HabitEntry(date: Date(), data: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (HabitEntry) -> Void) {
        completion(HabitEntry(date: Date(), data: SharedDefaults.readWidgetData()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HabitEntry>) -> Void) {
        let entry = HabitEntry(date: Date(), data: SharedDefaults.readWidgetData())
        // Refresh in 30 minutes — the app will force a reload on its own when state changes.
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - App Intent (interactive check-in, iOS 17+)

struct CheckHabitIntent: AppIntent {
    static var title: LocalizedStringResource = "Marcar hábito"
    static var description = IntentDescription("Marca o desmarca un hábito del día.")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Habit ID")
    var habitId: String

    @Parameter(title: "Completed", default: true)
    var completed: Bool

    init() {}
    init(habitId: String, completed: Bool = true) {
        self.habitId = habitId
        self.completed = completed
    }

    func perform() async throws -> some IntentResult {
        let defaults = SharedDefaults.store
        let key = SharedDefaults.habitQueueKey
        var queue: [[String: Any]] = []
        if let raw = defaults.string(forKey: key),
           let data = raw.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            queue = parsed
        }
        queue.append([
            "habitId": habitId,
            "completed": completed,
            "ts": Int(Date().timeIntervalSince1970 * 1000)
        ])
        if let data = try? JSONSerialization.data(withJSONObject: queue, options: []),
           let str = String(data: data, encoding: .utf8) {
            defaults.set(str, forKey: key)
        }
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// MARK: - View

struct HabitWidgetView: View {
    let entry: HabitEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Hábitos")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.white.opacity(0.7))
                Spacer()
                if let d = entry.data, d.totalCount > 0 {
                    Text("\\(d.completedCount)/\\(d.totalCount)")
                        .font(.caption.weight(.bold))
                        .foregroundColor(.white)
                        .monospacedDigit()
                }
            }

            if let d = entry.data, !d.habits.isEmpty {
                ProgressView(value: Double(d.completedCount), total: Double(max(d.totalCount, 1)))
                    .progressViewStyle(.linear)
                    .tint(.white)
                    .padding(.bottom, 2)

                ForEach(d.habits.prefix(4), id: \\.id) { habit in
                    habitRow(habit: habit)
                }
                if d.habits.count > 4 {
                    Text("+\\(d.habits.count - 4) más")
                        .font(.system(size: 9))
                        .foregroundColor(.white.opacity(0.45))
                }
            } else {
                Spacer()
                Text("Sin hábitos activos")
                    .font(.caption2)
                    .foregroundColor(.white.opacity(0.5))
                Spacer()
            }
        }
        .padding(12)
    }

    @ViewBuilder
    private func habitRow(habit: WidgetHabit) -> some View {
        if #available(iOS 17.0, *) {
            Button(intent: CheckHabitIntent(habitId: habit.id, completed: !habit.completed)) {
                rowContent(habit: habit)
            }
            .buttonStyle(.plain)
        } else {
            rowContent(habit: habit)
        }
    }

    private func rowContent(habit: WidgetHabit) -> some View {
        HStack(spacing: 6) {
            Text(habit.completed ? "✓" : habit.emoji)
                .font(.system(size: 12))
                .frame(width: 18)
            Text(habit.name)
                .font(.caption2)
                .foregroundColor(.white.opacity(habit.completed ? 0.55 : 1))
                .strikethrough(habit.completed, color: .white.opacity(0.55))
                .lineLimit(1)
            Spacer()
        }
    }
}

struct HabitWidget: Widget {
    let kind: String = "HabitWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitProvider()) { entry in
            if #available(iOS 17.0, *) {
                HabitWidgetView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                HabitWidgetView(entry: entry)
            }
        }
        .configurationDisplayName("Hábitos")
        .description("Marca tus hábitos del día desde la pantalla de inicio.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
`;

const HYDRATION_WIDGET_SWIFT = `import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Timeline

struct HydrationEntry: TimelineEntry {
    let date: Date
    let data: PhysicalWidgetDataModel?
}

struct HydrationProvider: TimelineProvider {
    func placeholder(in context: Context) -> HydrationEntry {
        HydrationEntry(date: Date(), data: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (HydrationEntry) -> Void) {
        completion(HydrationEntry(date: Date(), data: SharedDefaults.readPhysicalData()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HydrationEntry>) -> Void) {
        let entry = HydrationEntry(date: Date(), data: SharedDefaults.readPhysicalData())
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - App Intent (interactive, iOS 17+)

struct AddHydrationIntent: AppIntent {
    static var title: LocalizedStringResource = "Añadir hidratación"
    static var description = IntentDescription("Suma mililitros al objetivo de hidratación de hoy.")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Mililitros", default: 250)
    var ml: Int

    init() {}
    init(ml: Int = 250) {
        self.ml = ml
    }

    func perform() async throws -> some IntentResult {
        let defaults = SharedDefaults.store
        let key = SharedDefaults.hydrationQueueKey
        var queue: [[String: Any]] = []
        if let raw = defaults.string(forKey: key),
           let data = raw.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            queue = parsed
        }
        queue.append([
            "ml": ml,
            "ts": Int(Date().timeIntervalSince1970 * 1000)
        ])
        if let data = try? JSONSerialization.data(withJSONObject: queue, options: []),
           let str = String(data: data, encoding: .utf8) {
            defaults.set(str, forKey: key)
        }
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// MARK: - View

struct HydrationWidgetView: View {
    let entry: HydrationEntry

    private var percent: Double {
        guard let d = entry.data, d.hydrationTarget > 0 else { return 0 }
        return min(1, d.hydrationCurrent / d.hydrationTarget)
    }

    private var percentLabel: String {
        "\\(Int(percent * 100))%"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Agua")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.cyan.opacity(0.9))
                Spacer()
                Text(percentLabel)
                    .font(.caption.weight(.bold))
                    .foregroundColor(.white)
                    .monospacedDigit()
            }

            if let d = entry.data, d.hydrationTarget > 0 {
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.12), lineWidth: 6)
                    Circle()
                        .trim(from: 0, to: percent)
                        .stroke(Color.cyan, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 0) {
                        Text(String(format: "%.1f", d.hydrationCurrent))
                            .font(.system(size: 20, weight: .bold))
                            .foregroundColor(.white)
                            .monospacedDigit()
                        Text("/ \\(String(format: "%.1f", d.hydrationTarget)) L")
                            .font(.system(size: 9))
                            .foregroundColor(.white.opacity(0.5))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)

                if #available(iOS 17.0, *) {
                    HStack(spacing: 6) {
                        Button(intent: AddHydrationIntent(ml: 250)) {
                            Text("+250")
                                .font(.caption2.weight(.semibold))
                                .foregroundColor(.cyan)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 6)
                                .background(Color.cyan.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                        Button(intent: AddHydrationIntent(ml: 500)) {
                            Text("+500")
                                .font(.caption2.weight(.semibold))
                                .foregroundColor(.cyan)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 6)
                                .background(Color.cyan.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                } else {
                    Text("Toca para abrir")
                        .font(.system(size: 9))
                        .foregroundColor(.white.opacity(0.45))
                }
            } else {
                Spacer()
                Text("Sin datos")
                    .font(.caption2)
                    .foregroundColor(.white.opacity(0.5))
                Spacer()
            }
        }
        .padding(12)
    }
}

struct HydrationWidget: Widget {
    let kind: String = "HydrationWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HydrationProvider()) { entry in
            if #available(iOS 17.0, *) {
                HydrationWidgetView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                HydrationWidgetView(entry: entry)
            }
        }
        .configurationDisplayName("Hidratación")
        .description("Anillo de hidratación con botones rápidos +250 / +500ml.")
        .supportedFamilies([.systemSmall])
    }
}
`;

const FORGE_WIDGET_SWIFT = `import WidgetKit
import SwiftUI

// MARK: - Timeline

struct ForgeEntry: TimelineEntry {
    let date: Date
    let data: ForgeWidgetDataModel?
}

struct ForgeProvider: TimelineProvider {
    func placeholder(in context: Context) -> ForgeEntry {
        ForgeEntry(date: Date(), data: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (ForgeEntry) -> Void) {
        completion(ForgeEntry(date: Date(), data: SharedDefaults.readForgeData()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ForgeEntry>) -> Void) {
        let entry = ForgeEntry(date: Date(), data: SharedDefaults.readForgeData())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - View

struct ForgeWidgetView: View {
    let entry: ForgeEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("FORGE")
                    .font(.caption2.weight(.heavy))
                    .foregroundColor(.orange.opacity(0.9))
                    .tracking(1.2)
                Spacer()
                if let d = entry.data, d.whoopConnected {
                    Text("●")
                        .foregroundColor(.green)
                        .font(.caption2)
                }
            }

            if let d = entry.data {
                HStack(spacing: 10) {
                    Stat(label: "REC", value: d.recoveryScore.map { "\\($0)%" } ?? "--", color: .red.opacity(0.85))
                    Stat(label: "STR", value: d.strain.map { String(format: "%.1f", $0) } ?? "--", color: .orange)
                    Stat(label: "HRV", value: "--", color: .purple)
                }
                .padding(.top, 2)

                HStack(spacing: 10) {
                    Stat(label: "STEPS", value: numberLabel(d.steps), color: .cyan)
                    Stat(label: "KCAL", value: d.caloriesBurned.map { "\\(Int($0))" } ?? "--", color: .yellow)
                    Stat(label: "KG", value: d.weight.map { String(format: "%.1f", $0) } ?? "--", color: .green)
                }
            } else {
                Spacer()
                Text("Conecta WHOOP")
                    .font(.caption2)
                    .foregroundColor(.white.opacity(0.5))
                Spacer()
            }
        }
        .padding(12)
    }

    private func numberLabel(_ n: Int) -> String {
        if n >= 1000 { return String(format: "%.1fk", Double(n) / 1000.0) }
        return "\\(n)"
    }
}

private struct Stat: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(.white)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.system(size: 8, weight: .semibold))
                .foregroundColor(color)
                .tracking(0.5)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct ForgeWidget: Widget {
    let kind: String = "ForgeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ForgeProvider()) { entry in
            if #available(iOS 17.0, *) {
                ForgeWidgetView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                ForgeWidgetView(entry: entry)
            }
        }
        .configurationDisplayName("Forge")
        .description("Recovery, strain, HRV, pasos, kcal y peso en una card.")
        .supportedFamilies([.systemMedium])
    }
}
`;

const SWIFT_FILES = {
  'OrialWidgetsBundle.swift': BUNDLE_SWIFT,
  'SharedDefaults.swift': SHARED_DEFAULTS_SWIFT,
  'HabitWidget.swift': HABIT_WIDGET_SWIFT,
  'HydrationWidget.swift': HYDRATION_WIDGET_SWIFT,
  'ForgeWidget.swift': FORGE_WIDGET_SWIFT,
};

const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>CFBundleDevelopmentRegion</key>
\t<string>en</string>
\t<key>CFBundleDisplayName</key>
\t<string>Orial Widgets</string>
\t<key>CFBundleExecutable</key>
\t<string>$(EXECUTABLE_NAME)</string>
\t<key>CFBundleIdentifier</key>
\t<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
\t<key>CFBundleInfoDictionaryVersion</key>
\t<string>6.0</string>
\t<key>CFBundleName</key>
\t<string>$(PRODUCT_NAME)</string>
\t<key>CFBundlePackageType</key>
\t<string>XPC!</string>
\t<key>CFBundleShortVersionString</key>
\t<string>1.0</string>
\t<key>CFBundleVersion</key>
\t<string>1</string>
\t<key>NSExtension</key>
\t<dict>
\t\t<key>NSExtensionPointIdentifier</key>
\t\t<string>com.apple.widgetkit-extension</string>
\t</dict>
</dict>
</plist>
`;

const WIDGET_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>com.apple.security.application-groups</key>
\t<array>
\t\t<string>${APP_GROUP}</string>
\t</array>
</dict>
</plist>
`;

// ── Disk + Xcode manipulation ─────────────────────────────────────────────

function writeWidgetFiles(iosRoot) {
  const dir = path.join(iosRoot, WIDGET_TARGET_NAME);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(SWIFT_FILES)) {
    const target = path.join(dir, name);
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, content, 'utf8');
    }
  }
  const infoPlistPath = path.join(dir, 'Info.plist');
  if (!fs.existsSync(infoPlistPath)) {
    fs.writeFileSync(infoPlistPath, INFO_PLIST, 'utf8');
  }
  const entPath = path.join(dir, `${WIDGET_TARGET_NAME}.entitlements`);
  if (!fs.existsSync(entPath)) {
    fs.writeFileSync(entPath, WIDGET_ENTITLEMENTS, 'utf8');
  }
}

function targetExists(project, targetName) {
  // `findTargetKey(name)` compares `target.name === name` literally, but the
  // library stores `target.name` wrapped in quotes (e.g. `"OrialWidgets"`).
  // Walk the section ourselves so the check works either way.
  const section = project.pbxNativeTargetSection();
  for (const key in section) {
    if (/_comment$/.test(key)) continue;
    const t = section[key];
    if (!t || typeof t !== 'object') continue;
    if (t.name === targetName || t.name === `"${targetName}"`) {
      return key;
    }
  }
  return null;
}

function ensureWidgetTarget(pbxProjPath) {
  const project = xcode.project(pbxProjPath);
  project.parseSync();

  if (targetExists(project, WIDGET_TARGET_NAME)) {
    return;
  }

  const mainTargetUuid = project.getFirstTarget().uuid;
  if (!mainTargetUuid) {
    throw new Error('withWidgetExtension: could not find the main app target');
  }

  // Workaround for an xcode library bug: getPBXVariantGroupByKey crashes when
  // `objects['PBXVariantGroup']` is undefined. Make sure it exists before any
  // addFile/addSourceFile call.
  if (!project.hash.project.objects['PBXVariantGroup']) {
    project.hash.project.objects['PBXVariantGroup'] = {};
  }

  // 1) Create the widget extension target. The library auto-creates the
  //    Debug+Release build configurations, the .appex product, and an
  //    "Embed App Extensions" copy-files build phase on the main app target.
  const target = project.addTarget(
    WIDGET_TARGET_NAME,
    'app_extension',
    WIDGET_TARGET_NAME,
    WIDGET_BUNDLE_ID
  );
  if (!target || !target.uuid) {
    throw new Error('withWidgetExtension: addTarget failed');
  }

  // 2) Create a PBXGroup for the widget's source files. addSourceFile
  //    requires an existing group to attach to.
  const group = project.addPbxGroup(
    [],
    WIDGET_TARGET_NAME,
    WIDGET_TARGET_NAME,
    '"<group>"'
  );

  // 2b) The xcode library routes `addSourceFile` into the FIRST Sources
  //     build phase it can find when the target has none. We must create
  //     a Sources phase for the widget target first, otherwise the widget
  //     Swift files end up in the main app's Sources phase.
  project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);

  // 3) Add Swift sources to the group + target.
  for (const fileName of Object.keys(SWIFT_FILES)) {
    project.addSourceFile(
      `${WIDGET_TARGET_NAME}/${fileName}`,
      { target: target.uuid, group: group.uuid },
      group
    );
  }

  // 4) Customize build settings on each configuration that belongs to the new
  //    target. The library sets productName to the literal name with quotes.
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const key in configurations) {
    const cfg = configurations[key];
    if (!cfg || typeof cfg !== 'object') continue;
    if (cfg.productName === `"${WIDGET_TARGET_NAME}"`) {
      cfg.buildSettings = Object.assign({}, cfg.buildSettings, {
        PRODUCT_NAME: WIDGET_TARGET_NAME,
        PRODUCT_BUNDLE_IDENTIFIER: WIDGET_BUNDLE_ID,
        INFOPLIST_FILE: `${WIDGET_TARGET_NAME}/Info.plist`,
        CODE_SIGN_ENTITLEMENTS: `${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`,
        SWIFT_VERSION: '5.0',
        TARGETED_DEVICE_FAMILY: '1,2',
        IPHONEOS_DEPLOYMENT_TARGET: '16.0',
        GENERATE_INFOPLIST_FILE: 'NO',
        CURRENT_PROJECT_VERSION: '1',
        MARKETING_VERSION: '1.0',
        LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
      });
    }
  }

  fs.writeFileSync(pbxProjPath, project.writeSync());
}

const withWidgetExtension = (config) => {
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const iosRoot = cfg.modRequest.platformProjectRoot;
      writeWidgetFiles(iosRoot);
      return cfg;
    },
  ]);

  config = withXcodeProject(config, async (cfg) => {
    const pbxPath = cfg.modRequest.projectRoot + '/ios/Orial.xcodeproj/project.pbxproj';
    try {
      ensureWidgetTarget(pbxPath);
    } catch (e) {
      console.warn(
        '[withWidgetExtension] Could not auto-add the widget target to the Xcode project:\n  ' +
          e.message +
          '\nThe Swift sources are in place at ios/' + WIDGET_TARGET_NAME + '/ — add the target manually in Xcode by:\n' +
          '  1. File → New → Target → Widget Extension\n' +
          '  2. Product name: ' + WIDGET_TARGET_NAME + '\n' +
          '  3. Bundle id: ' + WIDGET_BUNDLE_ID + '\n' +
          '  4. Point at the existing files in ios/' + WIDGET_TARGET_NAME + '/\n' +
          '  5. Set CODE_SIGN_ENTITLEMENTS to ' + WIDGET_TARGET_NAME + '/' + WIDGET_TARGET_NAME + '.entitlements\n' +
          '  6. Add the extension to the main app\'s "Embed Foundation Extensions" phase'
      );
    }
    return cfg;
  });

  return config;
};

module.exports = withWidgetExtension;
module.exports.APP_GROUP = APP_GROUP;
module.exports.WIDGET_TARGET_NAME = WIDGET_TARGET_NAME;
module.exports.WIDGET_BUNDLE_ID = WIDGET_BUNDLE_ID;
module.exports.writeWidgetFiles = writeWidgetFiles;
module.exports.ensureWidgetTarget = ensureWidgetTarget;
module.exports.SWIFT_FILES = SWIFT_FILES;
