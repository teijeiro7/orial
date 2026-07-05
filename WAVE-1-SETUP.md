# Orial Wave 1 — Hermes Inbox + Native Widgets

What landed in this iteration and how to finish the setup on device.

---

## What was built

### 1. Generic Hermes Inbox (Orial side)

A single pull endpoint, typed payloads, idempotent consumption.

| File | Purpose |
|---|---|
| `src/services/hermesInboxService.ts` | Pulls typed items from the Hermes server, logs them, dispatches to the right handler, acks. |
| `src/services/hermesDispatchers/*.ts` | One dispatcher per type: `nutrition`, `weight`, `hydration`, `habit_checkin`, `expense`, `workout`, `whoop_extra`. |
| `src/services/openclawService.ts` | Added generic `getHermesServerUrl` / `fetchPendingInbox` / `ackInboxItem`. Old `getWorkoutServerUrl` / `fetchPendingWorkouts` are kept as deprecated aliases. |
| `drizzle/schema.ts` | New tables `hermes_inbox_log` and `whoop_extras`. |
| `drizzle/migrations/0006_hermes_inbox_and_whoop_extras.sql` | Auto-generated migration. |
| `app/settings/jarvis.tsx` | Renamed the "Workout Server" section to "Hermes Inbox"; health check is now `GET /inbox/pending`. |
| `app/(tabs)/gym.tsx` | Now uses the generic inbox; the tab's badge counts new **gym sessions** appearing since the last sync, not total processed items. |
| `src/services/backgroundSync.ts` | `expo-background-fetch` task that pulls the inbox + drains widget queues + republishes widget data on a ~15 min interval. |
| `app/_layout.tsx` | Calls `refreshFromBackground()` on cold start, on every `active` / `background` AppState change, and registers the background task. |

### 2. Native iOS Widgets (WidgetKit / SwiftUI)

Three home screen widgets; the first two are interactive on iOS 17+.

| Widget | Family | Interactive | Data source |
|---|---|---|---|
| **Hábitos** | Small + Medium | ✅ check-in per hábito | `widget_data` |
| **Hidratación** | Small | ✅ +250 / +500 ml | `physical_widget_data` |
| **Forge** | Medium | — read-only | `forge_widget_data` |

| File | Purpose |
|---|---|
| `plugins/withWidgetExtension.js` | Expo config plugin that creates the `OrialWidgets` target in the Xcode project, writes the Swift sources + Info.plist + entitlements, and embeds the extension in the main app. |
| `app.config.js` | Registers `./plugins/withWidgetExtension` in the plugin chain (right after the App-Groups plugin). |
| `src/services/widgetService.ts` | New `consumeQueues()` reads the App-Group UserDefaults queues written by widget App Intents and applies them to SQLite. Existing `updateWidgetData()` is unchanged. |

The widget sources live in the plugin (`SWIFT_FILES` constant) so they are written to `ios/OrialWidgets/` the first time the plugin runs, and the Swift code stays in one place alongside its pbxproj wiring.

---

## What to do on device

### Step 1 — Generate / apply the DB migration

The migration file is already on disk (`drizzle/migrations/0006_…sql`). It will be applied automatically on the next app launch (via `useMigrations` in `src/services/database.ts`). Nothing to run manually unless you want to verify against a fresh local DB:

```bash
npm run db:push
```

### Step 2 — Run `expo prebuild` to wire the widget target

The config plugin is registered, but the Xcode project is currently **clean** (no widget target yet, no `ios/OrialWidgets/` directory). Run prebuild once to let the plugin do its work:

```bash
npx expo prebuild --platform ios --clean
```

What this does:

1. Regenerates `ios/` from `app.config.js`.
2. Runs the `withWidgetExtension` plugin, which:
   - Creates `ios/OrialWidgets/` and writes all 5 Swift files, `Info.plist`, and `OrialWidgets.entitlements`.
   - Adds the `OrialWidgets` PBXNativeTarget to `ios/Orial.xcodeproj/project.pbxproj` (idempotent — safe to re-run).
   - Adds an "Embed App Extensions" copy-files build phase to the main app.
   - Configures the widget's Debug + Release build settings (Bundle ID `com.orial.app.widgets`, `IPHONEOS_DEPLOYMENT_TARGET=16.0`, `CODE_SIGN_ENTITLEMENTS`, etc.).

If prebuild fails on the pbxproj step, open `ios/Orial.xcworkspace` in Xcode and add the Widget Extension target manually. The Swift files and entitlements are already in place. See "Manual Xcode setup" below.

### Step 3 — Build & install

```bash
npm run ios
```

On first launch after installing, the Orial app creates a fresh SQLite DB with the new tables. Background-fetch is registered automatically (no permission prompt; iOS will grant it silently if the user has Background App Refresh enabled in Settings).

### Step 4 — Add the widgets to your home screen

1. Long-press an empty area on the home screen → tap the **+** (top left).
2. Search for "Orial".
3. You'll see three widgets: **Hábitos**, **Hidratación**, **Forge**.
4. Add them. Drag the **Hábitos** widget to a small or medium slot; the habit check-in buttons work on iOS 17+. The **Hidratación** widget exposes +250 / +500 ml buttons.

### Step 5 — Set the Hermes server URL

Open Orial → **Settings** → **Hermes Agent**. Enter the URL of your Hermes server (the same one you were using for workouts). The "Test" button hits `GET {url}/inbox/pending`. Orial will start polling on the next background tick (or immediately if you pull-to-refresh the Gym tab).

### Step 6 — Set the Hermes server endpoints (Hermes side)

Orial only consumes from your server. Hermes must:

- Expose `GET /inbox/pending` → 200 `[{id, type, payload, createdAt}]` (or 204 when empty).
- Expose `DELETE /inbox/{id}` → 200/204 (Orial calls this after successful consumption).
- Optionally accept `POST /inbox/publish` so you can post parsed screenshots from the Telegram bot. See `.planning/HERMES-WHOOP-OCR-SPEC.md` for the WHOOP payload schema.

The migration from the old `/workouts/pending` endpoint to the new `/inbox/pending` happens on the Hermes server side. The old `getWorkoutServerUrl` slot in Orial is preserved and now points to the same URL, so anything you already had configured keeps working — the new pull just hits `/inbox/pending` on the same host.

---

## Interactive widget flow

1. You tap a "check" button on the Hábitos widget.
2. The widget extension runs `CheckHabitIntent.perform()` (iOS 17+ App Intent). No app open.
3. The intent appends `{habitId, completed, ts}` to the JSON array stored at `widget_habit_checkin_queue` in the App Group `group.com.orial.app.widget`.
4. The intent calls `WidgetCenter.shared.reloadAllTimelines()` so the widget shows the new state immediately.
5. On the next time Orial is opened (or the background task runs), `widgetService.consumeQueues()` reads the queue, writes the habit entries to SQLite, clears the queue, and republishes `widget_data` so the next refresh of the widget shows the up-to-date state.

Same flow for `+250 ml` on the Hidratación widget → `widget_hydration_delta_queue` → `consumeQueues()` → `hydrationService.addWater()`.

If the app stays closed for hours, the widget will still show the latest snapshot (it auto-refreshes on a 15-min timeline and on every `reloadAllTimelines` call). The queue itself drains on the next app open or background fetch.

---

## Manual Xcode setup (fallback if prebuild fails)

If the config plugin fails to add the target, the Swift files are still on disk at `ios/OrialWidgets/`. To add the target manually in Xcode:

1. Open `ios/Orial.xcworkspace` in Xcode.
2. **File → New → Target… → Widget Extension**.
3. Product name: `OrialWidgets`.
4. Bundle id: `com.orial.app.widgets`.
5. Uncheck "Include Configuration Intent" (we use StaticConfiguration).
6. When prompted, **don't** activate the new scheme.
7. Delete the auto-generated `OrialWidgets.swift` and `Info.plist` from the new target; point the target at the existing files in `ios/OrialWidgets/`.
8. In the target's **Build Settings**:
   - `INFOPLIST_FILE` → `OrialWidgets/Info.plist`
   - `CODE_SIGN_ENTITLEMENTS` → `OrialWidgets/OrialWidgets.entitlements`
   - `IPHONEOS_DEPLOYMENT_TARGET` → `16.0` (interactive widgets require iOS 17+ at runtime; deployment 16 lets the widget compile against 16 but interactive intents are runtime-gated)
9. In the main app target, **Build Phases → + → New Copy Files Phase**:
   - Destination: **PlugIns**
   - Add the `OrialWidgets.appex` product from the Widgets target.
10. **Product → Clean Build Folder**, then rebuild.

The plugin will detect the target already exists on the next prebuild and skip its work.

---

## Verifying the data plane

- **Inbox audit table**: `SELECT * FROM hermes_inbox_log ORDER BY received_at DESC LIMIT 20;` shows what arrived, what was consumed, what errored.
- **WHOOP extras**: `SELECT date, source, data_json FROM whoop_extras ORDER BY captured_at DESC LIMIT 20;` shows the OCR-extracted WHOOP data once Hermes starts sending it.
- **Widget queues**: iOS Simulator → Device → Erase All Content and Settings to see queues build; on a real device, the queues are only ever in-memory of the widget extension (they live in `UserDefaults(suiteName: "group.com.orial.app.widget")`) and are cleared after each consumption.

---

## What was NOT done (out of scope, flagged separately)

- **WHOOP screenshot OCR**: The Hermes-side work to parse WHOOP screenshots is documented in `.planning/HERMES-WHOOP-OCR-SPEC.md`. Orial already accepts the payloads; you implement the producer on the Hermes side.
- **Android widget**: The plugin only handles iOS for now. Android widgets need Jetpack Glance (Kotlin) and would be a follow-up.
- **UI for WHOOP extras**: The data is stored in `whoop_extras` but no UI surface yet. Follow-up: a Forge detail screen showing the per-stage sleep graph, stress timeline, target strain explanation, etc.
- **Weekly view / correlations / nudges**: Out of scope for this wave; planned for Wave 2.
