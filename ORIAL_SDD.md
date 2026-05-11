# Orial — Spec Driven Development

> **Version**: 1.0.0  
> **Date**: 2026-05-11  
> **Status**: Ready for implementation  
> **Target AI**: Pass this entire document as system context before starting any implementation task.

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Data Models](#4-data-models)
5. [Feature Specifications](#5-feature-specifications)
   - 5.1 Auth & Onboarding
   - 5.2 Habit Tracker
   - 5.3 Openclaw AI Integration
   - 5.4 Notion Sync
   - 5.5 Reminders & Calendar
   - 5.6 Push Notifications
   - 5.7 Home Screen Widgets
6. [API Contracts](#6-api-contracts)
7. [State Management](#7-state-management)
8. [Navigation & Routing](#8-navigation--routing)
9. [Design System](#9-design-system)
10. [Project File Structure](#10-project-file-structure)
11. [Implementation Phases](#11-implementation-phases)
12. [Testing Strategy](#12-testing-strategy)
13. [Security & Privacy](#13-security--privacy)
14. [Performance Targets](#14-performance-targets)
15. [Environment & Configuration](#15-environment--configuration)

---

## 1. Project Vision

### 1.1 Summary

**Orial** is a personal productivity mobile app (iOS + Android) that unifies habit tracking, AI assistance, knowledge management, and calendar integration into a single glassmorphism-styled interface.

The core loop:
1. User defines goals and habits
2. Openclaw AI agent suggests, adjusts, and analyzes habits
3. Progress syncs bidirectionally to Notion
4. Reminders auto-create in iCloud/Google Calendar
5. Home screen widgets allow zero-open check-ins

### 1.2 Primary User

A single user (personal use). No multi-tenant, no teams. Auth is for securing personal data, not for social features.

### 1.3 Success Criteria

| Metric | Target |
|--------|--------|
| Cold start time | < 2 seconds |
| Habit check-in | ≤ 2 taps from home screen |
| Widget check-in | 1 tap, no app open |
| Notion sync latency | < 5 seconds after action |
| AI response time | < 4 seconds for suggestions |
| Offline functionality | Core habit tracking must work 100% offline |

---

## 2. Tech Stack

### 2.1 Decision: Flutter

**Why Flutter over React Native:**
- Native home screen widgets on both iOS (`flutter_home_widget`) and Android (Glance API) from one codebase
- True native performance without JS bridge
- `flutter_local_notifications` has mature iOS + Android widget communication
- Dart is type-safe and compiles AOT
- Single codebase for 100% of the feature set

### 2.2 Core Dependencies

```yaml
# pubspec.yaml — canonical dependency list
dependencies:
  flutter:
    sdk: flutter

  # State management
  flutter_riverpod: ^2.5.1
  riverpod_annotation: ^2.3.5

  # Navigation
  go_router: ^13.2.0

  # Local database (offline-first)
  drift: ^2.18.0
  drift_flutter: ^0.2.0
  sqlite3_flutter_libs: ^0.5.24

  # Secure storage
  flutter_secure_storage: ^9.0.0

  # HTTP client
  dio: ^5.4.3
  retrofit: ^4.1.0

  # Notion API
  # Custom wrapper — see Section 6.2

  # iCloud / Google Calendar
  device_calendar: ^4.3.0

  # Push notifications
  flutter_local_notifications: ^17.2.2
  firebase_messaging: ^15.1.3   # Android FCM + iOS APNs via Firebase

  # Home screen widgets
  home_widget: ^0.6.0

  # UI
  glassmorphism: ^3.0.0
  flutter_animate: ^4.5.0
  shimmer: ^3.0.0
  cached_network_image: ^3.3.1

  # Serialization
  freezed_annotation: ^2.4.1
  json_annotation: ^4.9.0

  # Utils
  intl: ^0.19.0
  uuid: ^4.4.0
  equatable: ^2.0.5
  logger: ^2.3.0
  connectivity_plus: ^6.0.3

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_riverpod_lint: ^2.3.10
  riverpod_generator: ^2.3.11
  build_runner: ^2.4.9
  freezed: ^2.5.2
  json_serializable: ^6.8.0
  retrofit_generator: ^8.1.0
  drift_dev: ^2.18.0
  mocktail: ^1.0.4
  flutter_lints: ^4.0.0
```

### 2.3 Backend

**No dedicated Orial backend.** The app is fully client-side with direct integrations:

```
App → Openclaw Agent API (user's self-hosted endpoint)
App → Notion API (official REST API)
App → iCloud CalDAV / Google Calendar API
App → Firebase (push notifications only)
App → SQLite (local persistence via Drift)
```

This keeps architecture simple, avoids hosting costs, and puts user data in user-controlled services.

---

## 3. System Architecture

### 3.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────┐
│                   ORIAL FLUTTER APP                  │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  UI Layer │  │ Providers│  │  Repository Layer│   │
│  │(Screens/ │◄─┤(Riverpod)├─►│  (abstractions)  │   │
│  │ Widgets) │  │          │  └────────┬─────────┘   │
│  └──────────┘  └──────────┘           │              │
│                                       │              │
│              ┌────────────────────────┼──────────┐   │
│              │        Data Sources    │          │   │
│         ┌────▼────┐ ┌────────┐ ┌─────▼────┐     │   │
│         │  Drift  │ │Openclaw│ │  Notion  │     │   │
│         │  (Local │ │  API   │ │   API    │     │   │
│         │  SQLite)│ │(Remote)│ │ (Remote) │     │   │
│         └─────────┘ └────────┘ └──────────┘     │   │
│                                                  │   │
│         ┌────────────┐  ┌──────────────────┐    │   │
│         │  Calendar  │  │  Firebase FCM    │    │   │
│         │ (CalDAV /  │  │  (Push notif.)   │    │   │
│         │ Google API)│  └──────────────────┘    │   │
│         └────────────┘                          │   │
│              └─────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                          │
              ┌───────────▼──────────┐
              │   HOME SCREEN WIDGET  │
              │  (home_widget package)│
              │  iOS: WidgetKit       │
              │  Android: Glance API  │
              └───────────────────────┘
```

### 3.2 Offline-First Strategy

All user data writes go to **local Drift SQLite first**, then sync to Notion asynchronously. The app is fully functional without internet. A `SyncQueue` table tracks pending operations.

```
User Action → Local DB Write → UI Update (immediate)
                            → SyncQueue Insert
                            → Background sync when online
```

### 3.3 State Architecture Pattern

```
Screen → watches Provider → Provider calls Repository
Repository → checks local DB first → fetches remote if stale
Remote data → updates local DB → Provider auto-notifies → Screen rebuilds
```

---

## 4. Data Models

### 4.1 Habit

```dart
@freezed
class Habit with _$Habit {
  const factory Habit({
    required String id,           // UUID v4
    required String name,         // "Meditate 10 min"
    required String emoji,        // "🧘"
    required HabitCategory category,
    required HabitFrequency frequency,
    required List<int> targetDays, // [1,2,3,4,5] = Mon-Fri (ISO weekday)
    required int targetCount,     // times per day (default 1)
    required DateTime createdAt,
    String? description,
    String? notionPageId,         // linked Notion page
    String? color,                // hex override
    bool isArchived = false,
    bool isAiSuggested = false,
  }) = _Habit;
}

enum HabitCategory { health, mind, work, social, fitness, learning, other }
enum HabitFrequency { daily, weekly, custom }
```

### 4.2 HabitEntry (check-in)

```dart
@freezed
class HabitEntry with _$HabitEntry {
  const factory HabitEntry({
    required String id,
    required String habitId,
    required DateTime date,       // UTC, time component = 00:00:00
    required bool completed,
    required DateTime createdAt,
    String? note,
    String? notionEntryId,        // Notion DB row ID
    bool isSynced = false,
  }) = _HabitEntry;
}
```

### 4.3 Reminder

```dart
@freezed
class Reminder with _$Reminder {
  const factory Reminder({
    required String id,
    required String habitId,
    required TimeOfDay time,
    required List<int> days,      // ISO weekdays
    required bool isActive,
    String? calendarEventId,      // iCloud/Google Calendar event ID
    bool aiSuggested = false,
  }) = _Reminder;
}
```

### 4.4 AIMessage (chat log)

```dart
@freezed
class AIMessage with _$AIMessage {
  const factory AIMessage({
    required String id,
    required MessageRole role,    // user | assistant
    required String content,
    required DateTime timestamp,
    Map<String, dynamic>? metadata, // intent, action taken, etc.
  }) = _AIMessage;
}

enum MessageRole { user, assistant }
```

### 4.5 SyncQueueItem

```dart
@freezed
class SyncQueueItem with _$SyncQueueItem {
  const factory SyncQueueItem({
    required String id,
    required SyncOperation operation, // create | update | delete
    required SyncEntity entity,       // habit | entry | reminder
    required String entityId,
    required Map<String, dynamic> payload,
    required DateTime createdAt,
    int retryCount = 0,
    String? lastError,
  }) = _SyncQueueItem;
}
```

### 4.6 UserSettings

```dart
@freezed
class UserSettings with _$UserSettings {
  const factory UserSettings({
    required String id,
    // Openclaw
    required String openclawApiUrl,
    required String openclawApiKey,
    // Notion
    String? notionAccessToken,
    String? notionHabitsDbId,     // Notion database ID for habits
    String? notionLogsDbId,       // Notion database ID for daily logs
    // Calendar
    String? calendarAccountId,    // device_calendar account ID
    CalendarProvider calendarProvider = CalendarProvider.icloud,
    // App
    bool darkMode = true,
    bool aiRemindersEnabled = true,
    NotionSyncFrequency syncFrequency = NotionSyncFrequency.realtime,
    String? fcmToken,
  }) = _UserSettings;
}

enum CalendarProvider { icloud, google, outlook }
enum NotionSyncFrequency { realtime, hourly, daily }
```

### 4.7 Drift Table Definitions

```dart
// lib/data/local/tables/habits_table.dart
class HabitsTable extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get emoji => text().withDefault(const Constant('✅'))();
  TextColumn get category => text()();
  TextColumn get frequency => text()();
  TextColumn get targetDays => text()();      // JSON array
  IntColumn get targetCount => integer().withDefault(const Constant(1))();
  DateTimeColumn get createdAt => dateTime()();
  TextColumn get description => text().nullable()();
  TextColumn get notionPageId => text().nullable()();
  TextColumn get color => text().nullable()();
  BoolColumn get isArchived => boolean().withDefault(const Constant(false))();
  BoolColumn get isAiSuggested => boolean().withDefault(const Constant(false))();

  @override
  Set<Column> get primaryKey => {id};
}

// Similar pattern for: HabitEntriesTable, RemindersTable, 
// AIMessagesTable, SyncQueueTable, UserSettingsTable
```

---

## 5. Feature Specifications

### 5.1 Auth & Onboarding

#### Scope
No social auth. User sets up the app with their service credentials (Openclaw URL, Notion token). Credentials stored in `flutter_secure_storage`, never in plain storage or logs.

#### Onboarding Flow (linear, skippable steps)

```
Step 1: Welcome screen
  → App name, tagline, "Get Started" CTA
  → Skip option: "Set up later" → goes directly to Home

Step 2: Openclaw setup
  Fields:
    - Agent API URL (text input, placeholder: "https://your-agent.com/api")
    - API Key (password input)
  Actions:
    - "Test Connection" button → calls GET /health on the URL
    - Shows ✅ / ❌ badge inline
    - "Skip for now"

Step 3: Notion setup
  - "Connect Notion" button → OAuth flow via in-app WebView
  - After OAuth: shows workspace name + avatar
  - Auto-creates two Notion databases if they don't exist:
      "Orial — Habits" (database schema defined in Section 6.2)
      "Orial — Daily Logs" (database schema defined in Section 6.2)
  - "Skip for now"

Step 4: Calendar setup
  - "Allow Calendar Access" → requests device_calendar permission
  - Lists available calendars on device → user selects default
  - "Skip for now"

Step 5: First habit (optional)
  - Quick-add 1 habit to get momentum
  - Uses HabitCreationSheet (see Section 5.2)
  - "Add later"

Step 6: Notifications permission
  - Explain value: "Orial reminds you at the right time"
  - "Allow Notifications" → platform permission dialog
  - "Not now"
```

#### Acceptance Criteria
- [ ] Credentials survive app kill/restart (flutter_secure_storage)
- [ ] Each onboarding step is independently skippable
- [ ] Notion OAuth completes without leaving the app
- [ ] Calendar permission request follows platform UX guidelines
- [ ] "Test Connection" for Openclaw shows result in < 3s or timeout

---

### 5.2 Habit Tracker

#### 5.2.1 Home Dashboard

**Layout:**
```
┌─────────────────────────────────┐
│ Mon, 11 May                🔔   │  ← date + notification icon
│ Good morning, today              │
│ 4 of 10 habits done ███░░░ 40% │  ← overall day progress
├─────────────────────────────────┤
│ TODAY'S HABITS          [+ Add] │
│                                  │
│ ┌──────┐ ┌──────┐ ┌──────┐     │
│ │🧘  ✓ │ │📖    │ │🚿    │ ... │  ← habit grid (3 cols)
│ │Medit │ │Read  │ │Shower│     │
│ └──────┘ └──────┘ └──────┘     │
│                                  │
│ ╔═══════════════════════════╗   │
│ ║ 💡 ORIAL SUGGESTS         ║   │
│ ║ "Add a 5-min journal..."  ║   │  ← AI suggestion card
│ ║ [Add Habit]  [Dismiss]    ║   │
│ ╚═══════════════════════════╝   │
├─────────────────────────────────┤
│ [🏠] [📋] [🤖] [📅] [⚙️]       │  ← bottom nav
└─────────────────────────────────┘
```

**Habit Grid Card (per habit):**
- Circular progress ring around emoji (filled if completed)
- Tap → toggle completed for today (optimistic update)
- Long press → quick menu: [View Detail] [Edit] [Skip Today] [Archive]
- Color of ring = category color

**State rules:**
- Completed today → ring full, card slightly dimmer (done state)
- Not yet → ring empty, pulsing subtle glow
- Skipped → ring grey
- AI-suggested → small ✨ badge

#### 5.2.2 Habit List View (Tab: Habits)

```
┌─────────────────────────────────┐
│ MY HABITS               [+ Add] │
│ [Health][Mind][Work][All] ←chips│
├─────────────────────────────────┤
│ 🔥 7-day streak on 3 habits     │  ← streak summary
│ ░█░█░█░ (heatmap mini)          │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🧘 Meditate 10 min  [Health]│ │
│ │ ○ ● ● ○ ● ● ●  (7 days)   │ │  ← dot streak
│ │ Streak: 5  Best: 12  83%   │ │
│ │                         [✓]│ │  ← today checkbox
│ └─────────────────────────────┘ │
│ ... (repeat per habit)          │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ ║ AI INSIGHTS THIS WEEK      ║  │
│ ║ "Your morning habits are   ║  │
│ ║  87% consistent. Evening   ║  │
│ ║  habits drop to 40%."      ║  │
│ ╚═════════════════════════════╝ │
└─────────────────────────────────┘
```

#### 5.2.3 Habit Detail Screen

Accessed by tapping a habit in list view.

**Sections:**
1. **Header**: Large emoji + name + category chip + edit icon
2. **Progress Ring**: Full-width circular progress (current month %)
3. **Stats Row**: `Current Streak | Best Streak | Completion Rate | Total Done`
4. **Calendar Grid**: 30-day view, each day colored by completion
5. **Reminders**: List of active reminders with toggle + add button
6. **Notion Link**: Badge showing sync status + "View in Notion" link
7. **AI Section**: "Ask Orial about this habit" → opens chat pre-filled with context

#### 5.2.4 Habit Creation/Edit Sheet (Bottom Sheet)

**Fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | Text | Yes | Max 50 chars |
| Emoji | Emoji picker | Yes | Default: ✅ |
| Category | Segmented control | Yes | |
| Frequency | Toggle: Daily / Weekly / Custom | Yes | |
| Target days | Day chips (Mon-Sun) | If custom | |
| Target count | Stepper (1-10) | No | Default: 1 |
| Description | Multiline text | No | |
| Color | Color picker | No | Defaults to category color |

**Save behavior:**
1. Validate required fields
2. Write to local Drift DB
3. Enqueue `SyncQueueItem` for Notion
4. Create/update notification schedules
5. Refresh home widget data

#### 5.2.5 Streak & Analytics Rules

- **Streak**: consecutive days where `completed == true` for all `targetDays`
- **Completion rate**: `(completed_entries / total_target_days) * 100` for last 30 days
- Streak breaks at end of day (midnight local time) if not completed
- "Skip today" does not break streak (skipped ≠ failed)

---

### 5.3 Openclaw AI Integration

#### 5.3.1 What Openclaw Is

Openclaw is a self-hosted AI agent with a REST/WebSocket API. The user configures the endpoint URL + API key during onboarding. Orial treats it as a generic intelligent agent that accepts natural language instructions and returns structured or free-text responses.

**Assumption**: Openclaw exposes at minimum:
- `POST /chat` → send message, get response
- `GET /health` → connectivity check

If Openclaw supports WebSocket for streaming responses, Orial uses it. Otherwise falls back to HTTP polling.

#### 5.3.2 AI Chat Screen

Full-screen chat interface.

**Behavior:**
- Messages persist locally (AIMessagesTable)
- No message limit shown to user (paginated load in background)
- User can send free-text or tap **Quick Action chips**
- Quick action chips (pre-defined, always visible above keyboard):
  - "Suggest habits" → sends context bundle (current habits, completion rates)
  - "Analyze my week" → sends last 7 days of entry data
  - "Set reminder" → opens reminder creation with AI pre-filling time
  - "Sync to Notion now" → triggers manual sync

**Context bundle sent with every message:**
```json
{
  "user_context": {
    "current_habits": [...],
    "today_completions": [...],
    "week_stats": {...},
    "timestamp": "ISO8601"
  },
  "message": "user's text"
}
```

**AI response parsing:**
Orial looks for structured JSON in the AI response to trigger in-app actions:

```json
{
  "action": "suggest_habit",
  "payload": {
    "name": "5-min journaling",
    "category": "mind",
    "emoji": "📓",
    "reason": "You have strong morning habits but no reflection practice."
  },
  "display_message": "I noticed you don't have a journaling habit..."
}
```

Supported action types: `suggest_habit`, `create_reminder`, `show_stats`, `open_screen`

If no JSON action found, treat entire response as display message.

#### 5.3.3 AI Suggestions (Proactive)

**Trigger conditions** (checked on app foreground):
- Once per day, at first app open after 9am
- After 3+ consecutive habit failures
- When a new habit milestone is reached (7-day streak)

**Flow:**
1. Build context bundle
2. POST to Openclaw with prompt: "Given this user's habit data, suggest one improvement or new habit."
3. Parse response → show as suggestion card on Home Dashboard
4. User can: [Add Habit] (creates habit from suggestion) | [Dismiss] (suppresses for 24h)

#### 5.3.4 AI Streak Analysis

**Trigger**: User taps "Analyze my week" chip OR visits Analytics tab (future).

**Sends**: Last 7 days of all habit entries.

**Expected response**: Free-text analysis highlighting patterns, shown in a full-screen modal with share button.

---

### 5.4 Notion Sync

#### 5.4.1 OAuth Setup

Uses Notion's official OAuth 2.0 flow:
1. Open `https://api.notion.com/v1/oauth/authorize?...` in in-app WebView
2. Capture redirect with `notion://callback` deep link or WebView URL change detection
3. Exchange code for token via `POST https://api.notion.com/v1/oauth/token`
4. Store token in `flutter_secure_storage`

#### 5.4.2 Notion Database Schemas

**"Orial — Habits" database:**

| Property | Type | Notes |
|----------|------|-------|
| Name | Title | Habit name |
| Emoji | Rich text | |
| Category | Select | Health, Mind, Work, Social, Fitness, Learning, Other |
| Frequency | Select | Daily, Weekly, Custom |
| Target Days | Multi-select | Mon, Tue, Wed, Thu, Fri, Sat, Sun |
| Target Count | Number | |
| Active | Checkbox | !isArchived |
| Created | Date | |
| Orial ID | Rich text | UUID from local DB (for deduplication) |

**"Orial — Daily Logs" database:**

| Property | Type | Notes |
|----------|------|-------|
| Date | Date | Entry date |
| Habit | Relation | → Orial Habits DB |
| Completed | Checkbox | |
| Note | Rich text | |
| Orial Entry ID | Rich text | UUID for deduplication |

#### 5.4.3 Sync Logic

**Write path (App → Notion):**
```
1. Action happens locally (habit created, entry added)
2. SyncQueue item created: { operation, entity, entityId, payload }
3. SyncWorker picks up queue (runs on background isolate)
4. Sends Notion API request
5. On success: marks item synced, stores notionPageId/notionEntryId
6. On failure: increments retryCount, exponential backoff (max 3 retries)
7. After 3 failures: marks as failed, shows badge in settings
```

**Read path (Notion → App):**
- Only on manual "Sync from Notion" trigger or first setup
- Imports habits not yet in local DB (by OtorialID property)
- Does NOT overwrite local data — local is source of truth

**Conflict resolution**: Local always wins. Notion is write-only mirror.

#### 5.4.4 Sync Frequency

| Setting | Behavior |
|---------|----------|
| Real-time | SyncWorker runs after every local write |
| Hourly | SyncWorker runs every 60 minutes (BackgroundFetch) |
| Daily | SyncWorker runs once at 2am local time |

---

### 5.5 Reminders & Calendar

#### 5.5.1 Reminder Creation

Via Reminder creation sheet or AI-suggested reminder.

**Fields:**
- Habit (selector if not pre-filled)
- Time (time picker)
- Repeat: Every day / Selected days (chip selector)
- Calendar sync toggle: "Add to Calendar as event"
- "Let Orial suggest best time" toggle → calls Openclaw with habit completion pattern

**On save:**
1. Store Reminder in local DB
2. Schedule `flutter_local_notifications` notification
3. If calendar sync enabled: create calendar event via `device_calendar`

#### 5.5.2 Calendar Integration

Uses `device_calendar` package, which wraps:
- iOS: `EventKit` (iCloud, Exchange, Google if added to device)
- Android: `CalendarContract` (Google Calendar, Exchange)

**Calendar event created for each reminder:**
```
Title: "Orial: {habit name}"
Description: "Habit reminder from Orial app"
Start: reminder time
End: reminder time + 15 min
Recurrence: matches reminder days
Calendar: user's selected calendar from onboarding
```

**No direct iCloud/Google API auth needed** — uses device's calendar accounts.

#### 5.5.3 Calendar Screen

```
┌─────────────────────────────────┐
│ MAY 2026            [< >] [+]   │
│ Mo Tu We Th Fr Sa Su            │
│  1  2  3  4  5  6  7           │
│  8  9 10 ●11 12 13 14          │  ← ● = has habits/events
│ ...                             │
├─────────────────────────────────┤
│ TODAY — Monday, 11 May          │
│ 07:00 🧘 Meditate reminder     │
│ 09:00 📖 Read 30 pages         │
│ 18:00 🏋️ Workout               │
│ + Calendar events from device   │
└─────────────────────────────────┘
```

---

### 5.6 Push Notifications

#### 5.6.1 Types

| Type | Trigger | Payload |
|------|---------|---------|
| Habit reminder | Scheduled (local) | `{habit_id, habit_name, emoji}` |
| Streak at risk | 30min before midnight if habit incomplete | `{habit_id, streak_count}` |
| AI suggestion | When proactive AI suggestion ready | `{suggestion_text}` |
| Sync failed | After 3 Notion sync failures | `{entity, error}` |
| Streak milestone | 7, 14, 30, 60, 90, 365 days | `{habit_id, streak_count}` |

#### 5.6.2 Implementation

- **Local notifications** (reminders, streak at risk, milestones): `flutter_local_notifications`
- **Remote notifications** (AI suggestions from Openclaw webhook): Firebase Cloud Messaging
  - iOS: APNs via Firebase
  - Android: FCM directly
  - FCM token stored in UserSettings, shared with Openclaw endpoint on setup

#### 5.6.3 Notification Tap Actions

Tapping a notification opens Orial and navigates to:
- Habit reminder → Habit Detail Screen for that habit
- Streak at risk → Home Dashboard, habit card highlighted
- AI suggestion → AI Chat Screen with suggestion displayed
- Sync failed → Settings > Notion Sync

Use `go_router` deep link: `orial://habit/{id}`, `orial://chat`, `orial://settings/sync`

---

### 5.7 Home Screen Widgets

#### 5.7.1 Data Flow

```
App writes to SharedPreferences (via home_widget package)
           ↓
iOS WidgetKit reads SharedPreferences → renders Swift UI widget
Android Glance reads SharedPreferences → renders Compose widget
```

The `home_widget` package bridges Flutter app data to platform-native widget code.

#### 5.7.2 Widget Sizes & Content

**Small (2x2):**
- Today's date
- Top 3 habits with checkbox icons
- Tap checkbox → sends intent to app → toggles habit via background isolate

**Medium (4x2):**
- Today's date + streak fire emoji
- List of all today's habits with name + checkbox
- Completion count "4/10"

**Large (4x4):**
- All habits grid
- Weekly mini-heatmap
- "AI tip of the day" (last AI suggestion text, truncated)
- Today completion % ring

#### 5.7.3 Widget Check-in Flow

```
User taps checkbox in widget
    → Widget fires platform intent/callback
    → Flutter app background isolate wakes (home_widget.registerInteractivityCallback)
    → Isolate writes HabitEntry to local DB
    → Isolate updates SharedPreferences widget data
    → Widget refreshes
    → Isolate enqueues Notion sync
```

The app does NOT need to be open for widget check-ins to work.

#### 5.7.4 Widget Update Triggers

- App moves to background → `HomeWidget.saveWidgetData()` + `HomeWidget.updateWidget()`
- Habit check-in (in-app or widget) → same
- Every 15 minutes via background fetch (Android WorkManager / iOS BGAppRefreshTask)

#### 5.7.5 Native Widget Code (Required)

**iOS** (`ios/OrialWidget/OrialWidget.swift`):
Must be created as a Widget Extension target in Xcode. Reads from App Group shared container. Implement `TimelineProvider` + `EntryView`.

**Android** (`android/app/src/main/kotlin/.../OrialWidget.kt`):
Uses Glance API. Reads from `DataStore` shared with Flutter via `home_widget`.

> **Implementation note for AI**: When implementing widgets, follow the `home_widget` package documentation exactly. The native widget files cannot be auto-generated — they must be created manually as described in the package README.

---

## 6. API Contracts

### 6.1 Openclaw API

Orial makes no assumptions about the internal implementation of the user's Openclaw agent. It uses a minimal contract:

#### `GET /health`
```
Response 200: { "status": "ok", "agent_name": string }
Response 4xx/5xx: connection failed
```

#### `POST /chat`
```
Request:
{
  "message": string,
  "context": {
    "habits": Habit[],
    "today_entries": HabitEntry[],
    "week_stats": {
      "completion_rate": number,
      "best_habit": string,
      "worst_habit": string
    }
  },
  "session_id": string   // conversation continuity
}

Response 200:
{
  "message": string,
  "action": {            // optional
    "type": "suggest_habit" | "create_reminder" | "show_stats" | "open_screen",
    "payload": object    // action-specific
  }
}
```

If user's Openclaw endpoint returns a different schema, an adapter layer (`lib/data/remote/openclaw/openclaw_adapter.dart`) normalizes it before it reaches the Repository.

#### `POST /webhook/register` (optional)
```
Request: { "fcm_token": string, "events": ["suggestion", "analysis_ready"] }
Response 200: { "webhook_id": string }
```
Registers FCM token so Openclaw can push proactive suggestions.

### 6.2 Notion API

Base URL: `https://api.notion.com/v1`  
Auth header: `Authorization: Bearer {token}`  
Version header: `Notion-Version: 2022-06-28`

#### Used endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/users/me` | Validate token, get workspace info |
| `POST` | `/databases` | Create Habits / Logs databases |
| `POST` | `/databases/{id}/query` | Read existing habits |
| `POST` | `/pages` | Create habit page or log entry |
| `PATCH` | `/pages/{id}` | Update habit (name, archived state) |

#### Create Habits Database request body:
```json
{
  "parent": { "type": "page_id", "page_id": "{root_page_id}" },
  "title": [{ "type": "text", "text": { "content": "Orial — Habits" } }],
  "properties": {
    "Name": { "title": {} },
    "Emoji": { "rich_text": {} },
    "Category": { "select": { "options": [...] } },
    "Frequency": { "select": { "options": [...] } },
    "Target Days": { "multi_select": { "options": [...] } },
    "Target Count": { "number": { "format": "number" } },
    "Active": { "checkbox": {} },
    "Created": { "date": {} },
    "Orial ID": { "rich_text": {} }
  }
}
```

### 6.3 Calendar (device_calendar)

No direct HTTP — uses platform plugin. Key operations:

```dart
// Request permissions
final result = await _calendar.requestPermissions();

// Get available calendars
final calendarsResult = await _calendar.retrieveCalendars();

// Create event
final event = Event(calendarId)
  ..title = 'Orial: ${habit.name}'
  ..start = TZDateTime.from(startTime, local)
  ..end = TZDateTime.from(endTime, local)
  ..recurrenceRule = RecurrenceRule(RecurrenceFrequency.Weekly, daysOfWeek: [...]);
await _calendar.createOrUpdateEvent(event);

// Delete event
await _calendar.deleteEvent(calendarId, eventId);
```

---

## 7. State Management

### 7.1 Riverpod Provider Architecture

```
lib/
  providers/
    habits_provider.dart        → AsyncNotifierProvider<HabitsNotifier, List<Habit>>
    habit_entries_provider.dart → AsyncNotifierProvider<HabitEntriesNotifier, ...>
    ai_chat_provider.dart       → AsyncNotifierProvider<AIChatNotifier, List<AIMessage>>
    settings_provider.dart      → NotifierProvider<SettingsNotifier, UserSettings>
    sync_status_provider.dart   → StreamProvider<SyncStatus>
    connectivity_provider.dart  → StreamProvider<ConnectivityStatus>
```

### 7.2 HabitsNotifier (example pattern)

```dart
@riverpod
class HabitsNotifier extends _$HabitsNotifier {
  @override
  Future<List<Habit>> build() async {
    return ref.watch(habitRepositoryProvider).getActiveHabits();
  }

  Future<void> toggleToday(String habitId) async {
    // Optimistic update
    state = AsyncData(state.value!.map((h) {
      // update local state immediately
    }).toList());

    await ref.read(habitRepositoryProvider).toggleEntry(habitId, DateTime.now());
    ref.invalidateSelf(); // re-fetch for consistency
  }

  Future<void> createHabit(CreateHabitParams params) async { ... }
  Future<void> archiveHabit(String habitId) async { ... }
}
```

### 7.3 Sync Status Stream

```dart
// Exposes real-time sync state to UI (badge on settings icon)
enum SyncStatus { idle, syncing, failed, success }

@riverpod
Stream<SyncStatus> syncStatus(SyncStatusRef ref) {
  return ref.read(syncServiceProvider).statusStream;
}
```

---

## 8. Navigation & Routing

### 8.1 Route Map (go_router)

```dart
GoRouter(
  initialLocation: '/home',
  routes: [
    // Onboarding (shown only if !settings.onboardingCompleted)
    GoRoute(path: '/onboarding', builder: (_,_) => OnboardingScreen()),

    // Shell (bottom nav)
    ShellRoute(
      builder: (_, __, child) => MainShell(child: child),
      routes: [
        GoRoute(path: '/home',     builder: (_,_) => HomeScreen()),
        GoRoute(path: '/habits',   builder: (_,_) => HabitsScreen()),
        GoRoute(path: '/ai',       builder: (_,_) => AIChatScreen()),
        GoRoute(path: '/calendar', builder: (_,_) => CalendarScreen()),
        GoRoute(path: '/settings', builder: (_,_) => SettingsScreen()),
      ],
    ),

    // Detail screens (push on top of shell)
    GoRoute(
      path: '/habit/:id',
      builder: (_, state) => HabitDetailScreen(id: state.pathParameters['id']!),
    ),
    GoRoute(
      path: '/habit/:id/edit',
      builder: (_, state) => HabitEditSheet(id: state.pathParameters['id']!),
    ),
    GoRoute(
      path: '/reminder/new',
      builder: (_, state) => ReminderCreationSheet(
        habitId: state.uri.queryParameters['habit_id'],
      ),
    ),

    // Deep links from notifications
    GoRoute(path: '/settings/sync', builder: (_,_) => SyncSettingsScreen()),
  ],
)
```

### 8.2 Deep Link Scheme

```
orial://home
orial://habit/{id}
orial://habit/{id}/edit
orial://chat
orial://settings/sync
```

Register in:
- iOS: `ios/Runner/Info.plist` → `CFBundleURLSchemes: [orial]`
- Android: `android/app/src/main/AndroidManifest.xml` → intent filter

---

## 9. Design System

### 9.1 Color Palette

```dart
// lib/core/theme/orial_colors.dart
class OrialColors {
  // Backgrounds
  static const deepNavy    = Color(0xFF0A0A1A);
  static const darkBlue    = Color(0xFF0D1B2A);
  static const surface     = Color(0xFF1A1F3A);

  // Glass
  static const glassWhite  = Color(0x26FFFFFF); // 15% white
  static const glassBorder = Color(0x33FFFFFF); // 20% white

  // Accents
  static const violet      = Color(0xFF7C3AED);
  static const violetLight = Color(0xFFA78BFA);
  static const cyan        = Color(0xFF06B6D4);
  static const cyanLight   = Color(0xFF67E8F9);

  // Status
  static const success     = Color(0xFF10B981);
  static const warning     = Color(0xFFF59E0B);
  static const error       = Color(0xFFEF4444);

  // Text
  static const textPrimary   = Color(0xFFFFFFFF);
  static const textSecondary = Color(0xFFB0B7D3);
  static const textMuted     = Color(0xFF6B7280);

  // Category colors
  static const categoryHealth  = Color(0xFF10B981); // emerald
  static const categoryMind    = Color(0xFF8B5CF6); // violet
  static const categoryWork    = Color(0xFF3B82F6); // blue
  static const categorySocial  = Color(0xFFF59E0B); // amber
  static const categoryFitness = Color(0xFFEF4444); // red
  static const categoryLearn   = Color(0xFF06B6D4); // cyan
}
```

### 9.2 Glass Card Component

```dart
// lib/core/widgets/glass_card.dart
class GlassCard extends StatelessWidget {
  final Widget child;
  final double blurSigma;
  final EdgeInsets padding;
  final double borderRadius;
  final Color? accentColor; // optional colored border

  // Implementation:
  // ClipRRect → BackdropFilter(ImageFilter.blur) → Container(
  //   decoration: BoxDecoration(
  //     color: OrialColors.glassWhite,
  //     borderRadius: BorderRadius.circular(borderRadius),
  //     border: Border.all(color: accentColor ?? OrialColors.glassBorder),
  //   )
  // )
}
```

### 9.3 Typography

```dart
// Uses Inter font (Google Fonts)
static const TextStyle displayLarge = TextStyle(
  fontFamily: 'Inter', fontSize: 32, fontWeight: FontWeight.w700,
  color: OrialColors.textPrimary, letterSpacing: -0.5,
);
static const TextStyle headingMedium = TextStyle(
  fontFamily: 'Inter', fontSize: 20, fontWeight: FontWeight.w600,
  color: OrialColors.textPrimary,
);
static const TextStyle bodyMedium = TextStyle(
  fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w400,
  color: OrialColors.textSecondary,
);
static const TextStyle caption = TextStyle(
  fontFamily: 'Inter', fontSize: 12, fontWeight: FontWeight.w500,
  color: OrialColors.textMuted, letterSpacing: 0.5,
);
```

### 9.4 Spacing & Radius

```dart
// Spacing scale
const s4  = 4.0;
const s8  = 8.0;
const s12 = 12.0;
const s16 = 16.0;
const s20 = 20.0;
const s24 = 24.0;
const s32 = 32.0;

// Border radius
const radiusSm = 12.0;
const radiusMd = 16.0;
const radiusLg = 24.0;
const radiusXl = 32.0;
```

---

## 10. Project File Structure

```
orial/
├── lib/
│   ├── main.dart
│   ├── app.dart                        # MaterialApp + GoRouter + ProviderScope
│   │
│   ├── core/
│   │   ├── theme/
│   │   │   ├── orial_colors.dart
│   │   │   ├── orial_typography.dart
│   │   │   └── orial_theme.dart
│   │   ├── widgets/
│   │   │   ├── glass_card.dart
│   │   │   ├── habit_ring.dart         # circular progress ring
│   │   │   ├── streak_dots.dart        # 7-day dot row
│   │   │   ├── heatmap_grid.dart
│   │   │   └── loading_shimmer.dart
│   │   ├── constants/
│   │   │   └── app_constants.dart
│   │   └── utils/
│   │       ├── date_utils.dart
│   │       ├── streak_calculator.dart
│   │       └── logger.dart
│   │
│   ├── data/
│   │   ├── local/
│   │   │   ├── database.dart           # Drift AppDatabase
│   │   │   ├── tables/
│   │   │   │   ├── habits_table.dart
│   │   │   │   ├── habit_entries_table.dart
│   │   │   │   ├── reminders_table.dart
│   │   │   │   ├── ai_messages_table.dart
│   │   │   │   ├── sync_queue_table.dart
│   │   │   │   └── user_settings_table.dart
│   │   │   └── daos/
│   │   │       ├── habits_dao.dart
│   │   │       ├── entries_dao.dart
│   │   │       ├── reminders_dao.dart
│   │   │       ├── messages_dao.dart
│   │   │       └── sync_queue_dao.dart
│   │   │
│   │   ├── remote/
│   │   │   ├── openclaw/
│   │   │   │   ├── openclaw_api.dart   # Retrofit interface
│   │   │   │   ├── openclaw_adapter.dart
│   │   │   │   └── openclaw_models.dart
│   │   │   ├── notion/
│   │   │   │   ├── notion_api.dart
│   │   │   │   ├── notion_db_setup.dart
│   │   │   │   └── notion_models.dart
│   │   │   └── calendar/
│   │   │       └── calendar_service.dart
│   │   │
│   │   └── repositories/
│   │       ├── habit_repository.dart          # interface
│   │       ├── habit_repository_impl.dart     # implementation
│   │       ├── ai_repository.dart
│   │       ├── ai_repository_impl.dart
│   │       ├── notion_repository.dart
│   │       ├── notion_repository_impl.dart
│   │       └── settings_repository.dart
│   │
│   ├── domain/
│   │   ├── models/
│   │   │   ├── habit.dart
│   │   │   ├── habit_entry.dart
│   │   │   ├── reminder.dart
│   │   │   ├── ai_message.dart
│   │   │   ├── sync_queue_item.dart
│   │   │   └── user_settings.dart
│   │   └── use_cases/
│   │       ├── toggle_habit_today.dart
│   │       ├── calculate_streak.dart
│   │       └── sync_to_notion.dart
│   │
│   ├── providers/
│   │   ├── habits_provider.dart
│   │   ├── habit_entries_provider.dart
│   │   ├── ai_chat_provider.dart
│   │   ├── settings_provider.dart
│   │   ├── sync_status_provider.dart
│   │   └── connectivity_provider.dart
│   │
│   ├── services/
│   │   ├── notification_service.dart   # flutter_local_notifications setup
│   │   ├── sync_service.dart           # queue worker
│   │   ├── widget_service.dart         # home_widget updates
│   │   └── background_service.dart     # WorkManager / BGAppRefresh
│   │
│   └── ui/
│       ├── onboarding/
│       │   ├── onboarding_screen.dart
│       │   └── steps/
│       │       ├── welcome_step.dart
│       │       ├── openclaw_step.dart
│       │       ├── notion_step.dart
│       │       ├── calendar_step.dart
│       │       ├── first_habit_step.dart
│       │       └── notifications_step.dart
│       │
│       ├── shell/
│       │   └── main_shell.dart         # bottom nav shell
│       │
│       ├── home/
│       │   ├── home_screen.dart
│       │   ├── widgets/
│       │   │   ├── habit_grid_card.dart
│       │   │   ├── day_progress_bar.dart
│       │   │   └── ai_suggestion_card.dart
│       │
│       ├── habits/
│       │   ├── habits_screen.dart
│       │   ├── habit_detail_screen.dart
│       │   └── sheets/
│       │       ├── habit_creation_sheet.dart
│       │       └── habit_quick_menu.dart
│       │
│       ├── ai_chat/
│       │   ├── ai_chat_screen.dart
│       │   ├── chat_bubble.dart
│       │   └── quick_actions_bar.dart
│       │
│       ├── calendar/
│       │   └── calendar_screen.dart
│       │
│       └── settings/
│           ├── settings_screen.dart
│           ├── openclaw_settings.dart
│           ├── notion_settings.dart
│           ├── calendar_settings.dart
│           └── notification_settings.dart
│
├── ios/
│   ├── Runner/
│   └── OrialWidget/                    # Widget Extension target (manual Xcode setup)
│       ├── OrialWidget.swift
│       ├── OrialWidgetBundle.swift
│       └── Assets.xcassets/
│
├── android/
│   └── app/src/main/kotlin/.../
│       ├── MainActivity.kt
│       └── OrialWidget.kt              # Glance widget (manual setup)
│
├── test/
│   ├── unit/
│   │   ├── streak_calculator_test.dart
│   │   ├── sync_queue_test.dart
│   │   └── openclaw_adapter_test.dart
│   └── widget/
│       ├── habit_ring_test.dart
│       └── glass_card_test.dart
│
├── pubspec.yaml
├── analysis_options.yaml
└── .env.example
```

---

## 11. Implementation Phases

### Phase 0: Project Bootstrap (Day 1)
- [ ] `flutter create orial --org com.orial --platforms ios,android`
- [ ] Add all dependencies to `pubspec.yaml`
- [ ] Set up Drift database with all tables
- [ ] Configure Riverpod
- [ ] Set up GoRouter with all routes (stub screens)
- [ ] Implement design system (colors, typography, GlassCard widget)
- [ ] Configure linting (`analysis_options.yaml`)

**Done when**: App launches, shows Home stub, all routes navigate, no lint errors.

### Phase 1: Core Habit Tracking (Days 2-5)
- [ ] HabitsTable + HabitEntriesTable Drift DAOs
- [ ] HabitRepository (local only)
- [ ] HabitsNotifier provider
- [ ] Home Dashboard screen (habit grid, today progress)
- [ ] Habit toggle (optimistic update)
- [ ] Habit creation sheet
- [ ] Habit detail screen (stats, calendar grid)
- [ ] Habits list screen (with category filter)
- [ ] Streak calculator logic + unit tests

**Done when**: User can create, view, and check off habits with correct streak calculation.

### Phase 2: Notifications & Reminders (Days 6-7)
- [ ] NotificationService setup (iOS + Android)
- [ ] Reminder creation sheet
- [ ] Schedule/cancel notifications on reminder create/delete/toggle
- [ ] Streak at risk notification (23:30 check)
- [ ] Notification tap → deep link navigation

**Done when**: Reminders fire at scheduled times, tapping opens correct screen.

### Phase 3: Openclaw AI Integration (Days 8-10)
- [ ] OpenclawApi (Retrofit)
- [ ] OpenclawAdapter (schema normalization)
- [ ] AIRepository + AIChatNotifier
- [ ] AI Chat screen (full chat UI)
- [ ] Quick action chips
- [ ] Context bundle builder
- [ ] AI action parser (suggest_habit, create_reminder)
- [ ] Proactive suggestion trigger logic
- [ ] AI suggestion card on Home Dashboard

**Done when**: User can chat with Openclaw, receive habit suggestions, and have them added to the app.

### Phase 4: Notion Sync (Days 11-13)
- [ ] Notion OAuth flow (in-app WebView)
- [ ] NotionApi (Retrofit)
- [ ] Auto-create Notion databases on first connect
- [ ] SyncQueue worker (background isolate)
- [ ] Sync on habit create/update/archive
- [ ] Sync on entry create
- [ ] Sync status provider + UI badge
- [ ] Manual sync trigger in settings
- [ ] Sync frequency settings

**Done when**: Habits and daily logs appear in Notion within configured sync window.

### Phase 5: Calendar Integration (Days 14-15)
- [ ] CalendarService (device_calendar)
- [ ] Calendar screen (monthly view + event list)
- [ ] Create calendar event when reminder is created
- [ ] Delete calendar event when reminder is deleted
- [ ] Calendar account selector in settings

**Done when**: Reminders appear in device calendar app.

### Phase 6: Home Screen Widgets (Days 16-19)
- [ ] WidgetService (home_widget data writes)
- [ ] Widget data refresh on every app background
- [ ] iOS Widget Extension (Xcode target + Swift code)
- [ ] Android Glance widget (Kotlin)
- [ ] Widget interactivity (checkbox tap → toggle habit)
- [ ] Background isolate for widget check-ins
- [ ] Test on physical devices (simulators don't support widgets reliably)

**Done when**: Widgets show on home screen, checkboxes work without opening app.

### Phase 7: Onboarding & Polish (Days 20-21)
- [ ] Full onboarding flow
- [ ] Settings screens (all integrations)
- [ ] Error states + empty states for all screens
- [ ] Haptic feedback on habit toggle
- [ ] Animations (flutter_animate)
- [ ] App icons + splash screen

### Phase 8: Testing & Release (Days 22-25)
- [ ] Unit tests (streak, sync queue, adapter)
- [ ] Widget tests (GlassCard, HabitRing)
- [ ] Manual QA on physical iOS + Android devices
- [ ] TestFlight (iOS) + Internal Testing (Android)
- [ ] App Store / Play Store metadata

---

## 12. Testing Strategy

### 12.1 Unit Tests

| Module | What to test |
|--------|-------------|
| `streak_calculator.dart` | Edge cases: first day, streak reset, skip vs fail, weekly habits |
| `openclaw_adapter.dart` | Schema normalization: various response formats → normalized model |
| `sync_queue_worker.dart` | Retry logic, exponential backoff, max retries |
| `notion_db_setup.dart` | Database creation payload correctness |

### 12.2 Widget Tests

| Widget | What to test |
|--------|-------------|
| `GlassCard` | Renders with and without accentColor |
| `HabitRing` | Progress percentage renders correct arc |
| `StreakDots` | Correct dot fill for given completion array |

### 12.3 Integration Tests

Run on physical device or emulator:
- Habit create → appears on Home → check-in → updates progress ring
- Habit create → SyncQueue item created → (mock Notion API) → item cleared
- Reminder create → notification fires at correct time

### 12.4 Manual QA Checklist (pre-release)

- [ ] Offline: create habit, check in — survives airplane mode + restart
- [ ] Notion sync: all created habits appear in Notion DB
- [ ] iCloud Calendar: reminders appear in Calendar.app
- [ ] Widget: shows current data, checkbox works without app open
- [ ] Notification: reminder fires at correct time, tap opens correct screen
- [ ] Openclaw: chat sends context, suggestion adds habit
- [ ] Onboarding: all skip paths work, credentials persist

---

## 13. Security & Privacy

### 13.1 Credential Storage

| Credential | Storage |
|------------|---------|
| Openclaw API key | `flutter_secure_storage` (iOS Keychain / Android Keystore) |
| Notion OAuth token | `flutter_secure_storage` |
| FCM token | Drift `UserSettingsTable` (not sensitive) |

**Never** store credentials in:
- `SharedPreferences`
- `home_widget` shared data
- Logs

### 13.2 Network Security

- All Openclaw requests: HTTPS only (enforce in Dio interceptor, reject HTTP)
- Certificate pinning: optional, configurable — only implement if user's Openclaw endpoint is known
- Notion API: official HTTPS endpoint only

### 13.3 Data Privacy

- All habit data stays on device (SQLite) + user's own Notion workspace
- No Orial-owned backend = no data collection
- Firebase used only for push notification tokens (standard FCM use)
- If user revokes Notion access, stop all syncs immediately

### 13.4 Widget Data

Home screen widget data is written to `SharedPreferences` / `DataStore`. This data is readable by other apps on Android (pre-API 29 without encryption). Mitigation: write only habit names and completion status — no sensitive data.

---

## 14. Performance Targets

| Scenario | Target |
|----------|--------|
| App cold start (no network) | < 2s to interactive Home |
| Habit toggle response | < 100ms (optimistic UI) |
| AI chat message send→receive | < 4s (dependent on Openclaw) |
| Notion sync (10 habits) | < 5s on good connection |
| Widget refresh | < 500ms |
| Home Dashboard render (15 habits) | < 16ms per frame (60fps) |

### 14.1 Optimizations

- Habit grid on Home: use `const` constructors where possible
- Streak calculation: memoize in provider, invalidate only on new entry
- AI chat: paginate messages (load 50 at a time, virtualized list)
- Notion sync: batch writes (use Notion's batch API when available)
- Widget data: only write delta changes, not full dataset

---

## 15. Environment & Configuration

### 15.1 `.env.example`

```bash
# Openclaw (user-configured at runtime via onboarding, not build-time)
# These are NOT needed at build time.

# Firebase (required at build time for push notifications)
FIREBASE_PROJECT_ID=your-firebase-project-id

# Notion OAuth App (required at build time)
NOTION_CLIENT_ID=your-notion-oauth-client-id
NOTION_CLIENT_SECRET=your-notion-oauth-client-secret
NOTION_REDIRECT_URI=orial://notion/callback
```

### 15.2 Build Flavors

```
dev    → local SQLite, mock Notion responses, verbose logging
staging → real integrations, TestFlight/Internal Testing
prod   → release build, obfuscated, no debug logging
```

Configure with `--dart-define-from-file=env/dev.json`.

### 15.3 Required Platform Setup

**iOS `Info.plist` additions:**
```xml
<key>NSCalendarsUsageDescription</key>
<string>Orial adds habit reminders to your calendar</string>
<key>NSRemindersUsageDescription</key>
<string>Orial creates reminders for your habits</string>
<key>CFBundleURLSchemes</key>
<array>
  <string>orial</string>
  <string>notion</string>
</array>
```

**Android `AndroidManifest.xml` additions:**
```xml
<uses-permission android:name="android.permission.READ_CALENDAR" />
<uses-permission android:name="android.permission.WRITE_CALENDAR" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

**App Group (iOS — required for widgets):**
- Create App Group `group.com.orial.shared` in Apple Developer portal
- Add to both Runner target and OrialWidget target

---

## Appendix A: Key Decisions Log

| Decision | Choice | Reason |
|----------|--------|--------|
| Cross-platform | Flutter | Native widgets on both platforms |
| State management | Riverpod | Type-safe, testable, no boilerplate |
| Local DB | Drift (SQLite) | Type-safe SQL, migrations, reactive streams |
| Backend | None | Keep it simple, user owns their data |
| Calendar | device_calendar | No extra auth needed, uses OS accounts |
| Push (remote) | Firebase FCM | Only reliable cross-platform solution |
| Navigation | GoRouter | Deep link support, nested navigation |
| HTTP client | Dio + Retrofit | Type-safe endpoints, interceptors |

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| Openclaw | User's self-hosted AI agent, accessible via REST API |
| HabitEntry | A single day's check-in record for one habit |
| SyncQueue | Local table of pending Notion API operations |
| Widget | Native home screen widget (iOS WidgetKit / Android Glance) |
| Streak | Consecutive days of habit completion without a miss |

---

*End of ORIAL_SDD.md — v1.0.0*
