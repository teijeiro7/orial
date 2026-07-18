# Orial — Architecture

Orial is a personal performance app (biometrics, fitness, nutrition, finance,
habits) for iOS and Android. This document describes the architecture as it
actually exists in the codebase today. For historical context only, the
previous Flutter/Dart design doc is kept at
[`archive/ORIAL_SDD_FLUTTER.md`](../archive/ORIAL_SDD_FLUTTER.md) — that
architecture was replaced and should never be used for implementation
decisions.

## 1. Tech stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 |
| Language | TypeScript 5.9 (strict, `tsc --noEmit` as the typecheck gate) |
| Routing | Expo Router 6 (file-based, root at `./app`) |
| Local DB | Expo SQLite + Drizzle ORM (`drizzle-orm/expo-sqlite`) |
| Cloud DB | Supabase (Postgres) — sync target + backend for the "Jarvis" agent |
| State | Zustand (single small store; most state is local/component or SQLite-backed) |
| Auth | Firebase Auth (`@react-native-firebase/auth`) |
| Notifications | Expo Notifications + Firebase Cloud Messaging |
| Testing | Jest + `jest-expo` preset |
| Build | EAS Build (`eas.json`) |

React 19.1, react-native 0.81.5, expo ~54.0.33, drizzle-orm ^0.45.2,
zustand ^5.0.13 (see `package.json` for exact pins).

## 2. File structure

```
orial/
├── app/                     # Expo Router — file-based routing
│   ├── _layout.tsx          # Root layout (providers, auth gate)
│   ├── (tabs)/              # Tab bar screens: index, gym, macros, caffeine,
│   │                        #   intake, insights, finance, forge, jarvis, settings
│   ├── onboarding/           # First-run flow + steps (Calendar, Notifications,
│   │                        #   Notion, Openclaw, Welcome)
│   ├── settings/            # Notion, Calendar, Jarvis sub-screens
│   ├── screens/             # Full-screen flows (e.g. MealCameraScreen)
│   ├── whoop/                # WHOOP OAuth callback handler
│   └── *.tsx                 # Standalone routes (login, hydration, profile,
│                              #   supplements, weight-history, etc.)
├── src/
│   ├── components/           # Shared UI (GlassCard, charts, sheets, modals)
│   ├── context/               # AuthContext (Firebase auth state + actions)
│   ├── hooks/                 # Cross-cutting hooks (e.g. NFC water-intake queue drain)
│   ├── services/               # One file per domain — business logic + data access
│   ├── stores/                 # Zustand store(s)
│   └── utils/                   # colors, typography, misc helpers
├── drizzle/
│   ├── schema.ts                # Single source of truth for all local tables
│   └── migrations/               # Auto-generated SQL migrations + migrator manifest
├── supabase/
│   └── migrations/001_initial.sql # Postgres schema mirrored from drizzle/schema.ts
├── plugins/                       # Expo config plugins (native tweaks, iOS Swift helper)
├── assets/                        # Icons, splash screens, fonts
├── app.config.js                  # Expo app config (plugins, bundle IDs, EAS project)
├── drizzle.config.ts               # drizzle-kit config
├── jest.config.js / jest.setup.js  # Test configuration
└── eas.json                        # EAS Build profiles
```

There is no `src/types/` or `src/repositories/` directory — types are
defined and exported inline in the service files that use them (e.g.
`UserProfile` in `src/services/authService.ts`), and services query Drizzle
directly rather than going through a separate repository layer.

## 3. Data layer

**Local (source of truth for the app UI):** Expo SQLite, accessed exclusively
through Drizzle ORM. `src/services/database.ts` opens the database
(`orial.db`) and exports a single `db` instance built from
`drizzle/schema.ts`. `drizzle/schema.ts` defines 27 tables covering habits,
reminders, WHOOP tokens/daily metrics, body metrics, pedometer history,
hydration + sodium, supplements, manual metrics, weight predictions,
nutrition logs, tasks, gym (routines/exercises/sessions/sets), finance
(accounts/subscriptions/wishlist), hydration profile, caffeine logs, and
insight logs. Migrations are generated with `npm run db:generate` (drizzle-kit)
and applied at runtime via `useMigrations` in `database.ts`.

**Cloud (Supabase):** a Postgres project whose schema is mirrored by hand in
`supabase/migrations/001_initial.sql`. The app is offline-first: every read
and write goes to local SQLite first; `src/services/syncEngine.ts` (pure,
dependency-injected, fully unit-testable) then pushes/pulls changed rows to
Supabase on a per-table, per-direction cursor using last-write-wins semantics
keyed by a timestamp column. The concrete SQLite/Supabase/AsyncStorage
adapters live in `src/services/syncService.ts`; `syncScheduler.ts` drives
periodic sync. `src/services/supabaseService.ts` wraps the Supabase JS client
and degrades gracefully (sync stays disabled) when
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are missing or
placeholders. `migrateLocalToSupabase.ts` performs a one-time, idempotent
backfill of existing local data to Supabase.

The Supabase project is also read/written server-side (via the
`service_role` key, never shipped in the app) by an external agent
("Jarvis") that generates insights into the `insight_logs` table — the app
and Jarvis are decoupled and share only the Postgres schema.

**Secrets:** OAuth tokens and integration credentials (e.g. Notion access
token) are stored in `expo-secure-store` (iOS Keychain / Android Keystore),
not in SQLite or AsyncStorage.

## 4. Auth

Firebase Auth (`@react-native-firebase/auth`) is the only identity provider,
exposed to the app through `src/context/AuthContext.tsx` and
`src/services/authService.ts`. Four sign-in methods are wired up:

- Email/password (`loginWithEmail`, `registerWithEmail`)
- Google (`@react-native-google-signin/google-signin`)
- Apple (`@invertase/react-native-apple-authentication`)
- Facebook (`react-native-fbsdk-next`)

`AuthContext` subscribes to `auth().onAuthStateChanged`, keeps both the raw
Firebase user and an app-level `UserProfile`, and exposes login/register/
logout/update-profile/password-reset actions to the rest of the app. An
optional biometric gate (`src/services/biometricAuthService.ts`, Expo Local
Authentication) can lock the app behind Face ID / Touch ID after Firebase
auth succeeds.

## 5. State management

State is intentionally light on global stores:

- **Zustand** (`src/stores/appStore.ts`) holds exactly one persisted flag
  today (`onboardingCompleted`), persisted to AsyncStorage via
  `zustand/middleware`'s `persist`.
- **Domain state lives in SQLite**, read/written through the relevant
  service (`gymService`, `hydrationService`, `nutritionService`,
  `supplementService`, `financeService`, etc.) and fetched with local
  component state / hooks — there is no Redux-style global domain store.
- **`AuthContext`** (React Context, not Zustand) carries auth/session state.

## 6. External integrations

| Integration | Purpose | Key files |
|---|---|---|
| WHOOP | OAuth 2.0 token exchange + recovery/strain/sleep/body-metric ingestion | `src/services/whoopService.ts`, `app/whoop/callback.tsx` |
| Notion | Bidirectional habit/log sync via a real-time queue with retry | `src/services/notionService.ts`, `forgeNotionSync.ts`, `app/settings/notion.tsx` |
| Openclaw (AI assistant, "Jarvis") | Habit suggestions + AI insights, configurable endpoint | `src/services/openclawService.ts`, `app/openclaw-config.tsx`, `app/(tabs)/jarvis.tsx` |
| Calendar | iCloud / Google Calendar reminder sync | `src/services/calendarService.ts`, `app/settings/calendar.tsx` |
| HealthKit (iOS) | Body metrics via `react-native-health` | `src/services/healthKitService.ts` |
| Pedometer | Step counting via Expo Sensors | `src/services/pedometerService.ts` |
| Push notifications | Expo Notifications + Firebase Cloud Messaging | `src/services/notificationService.ts`, `forgeNotificationService.ts` |
| Home-screen widget data | Writes shared preferences (`react-native-default-preference`) consumed by a native widget | `src/services/widgetService.ts` |

## 7. Build & deploy

- **Config**: `app.config.js` is the single Expo config (JS, not static JSON)
  so plugin arguments and bundle IDs can be driven by environment variables
  (`EXPO_PUBLIC_APP_SCHEME`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, Facebook App
  ID, etc.). iOS bundle ID `com.orial.app`, same package ID on Android.
- **Native config plugins** (`plugins/`): `withReactNativeDefaultPreference`,
  `withWaterIntent` (+ its native `plugins/ios/LogWaterIntent.swift` helper
  for NFC-triggered water logging), and `withFmtCppStandardFix` (build-flag
  fix for a native dependency). Applied through the `plugins` array in
  `app.config.js`.
- **Build system**: EAS Build (`eas.json`), targeting iOS and Android; the
  `/ios` and `/android` native folders are generated (git-ignored) rather
  than committed.
- **Testing**: `npm test` runs Jest with `jest-expo`; tests live as
  `*.test.ts(x)` next to the code under test (e.g.
  `src/services/gymCoachService.test.ts`). The Supabase client is mocked so
  tests run offline. `npm run typecheck` runs `tsc --noEmit`.

## 8. Notable conventions

- **Dependency injection for testability**: `syncEngine.ts` takes its
  `LocalStore` / `SyncRemote` / `CursorStore` as interfaces so the sync
  algorithm itself has zero React Native, SQLite, or Supabase dependencies
  and can be unit tested in isolation.
- **Graceful degradation**: services that depend on optional external
  config (Supabase, Openclaw, Notion) detect missing/placeholder
  credentials and disable themselves instead of throwing at startup.
- **No custom backend**: aside from Supabase (used purely as a Postgres
  store + sync target, no Edge Functions in this codebase today) and the
  external Jarvis agent, the app talks directly to third-party APIs (WHOOP,
  Notion, Firebase) from the client.

## Maintenance

Update this document whenever a major architectural change lands (new data
store, new auth provider, new sync strategy, restructured `src/`). It should
stay under 400 lines — trim before adding.
