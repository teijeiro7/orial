<div align="center">
  <img src="./assets/orial-icon.png" alt="Orial Logo" width="120" height="120" style="border-radius: 24px;" />

  <h1>Orial</h1>

  <p><strong>Personal performance OS for iOS & Android</strong></p>

  <p>
    <img src="https://img.shields.io/badge/React_Native-0.81-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React Native" />
    <img src="https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/SQLite-offline--first-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
    <img src="https://img.shields.io/badge/Firebase-auth-FFCA28?style=flat-square&logo=firebase&logoColor=black" alt="Firebase" />
  </p>
</div>

---

## Overview

Orial unifies biometrics, fitness, nutrition, finance, and habit tracking into a single glassmorphism-styled interface. It syncs with WHOOP for recovery data, Notion for knowledge management, and your native calendar for reminders — all with an offline-first SQLite database so the core always works without a connection.

---

## Features

### Dashboard
Real-time personal metrics at a glance:
- **Peak State score** — composite readiness index derived from WHOOP recovery, HRV, sleep, and strain
- **WHOOP integration** — recovery score, sleep performance, HRV, resting heart rate
- **Smart hydration** — dynamic daily target adjusted by activity and environment
- **Supplement tracker** — daily stack with streaks and intake logging
- **Nutrition & macros** — daily log with caloric and macro targets
- **Weight prediction** — trend-based forecasting from historical data

### Daily
- Habit tracker with configurable frequency and target days
- AI-suggested habits via Openclaw integration
- Reminders synced bidirectionally with iCloud / Google Calendar

### Gym
- Progressive overload trainer with session logging
- Volume and PR tracking per exercise

### Finance
- Net worth dashboard
- Expense and income tracking
- Subscription manager

### Settings
- **Notion sync** — bidirectional habit and log sync with a real-time queue and retry logic
- **Jarvis** — Openclaw AI assistant configuration
- **Calendar** — iCloud or Google Calendar account binding
- **Biometric auth** — Face ID / Touch ID lock

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 + Expo 54 |
| Navigation | Expo Router (file-based) |
| Language | TypeScript 5.9 |
| Local DB | Expo SQLite + Drizzle ORM |
| State | Zustand |
| Auth | Firebase (Google, Apple, Facebook) |
| Biometrics | Expo Local Authentication |
| Wearable | WHOOP REST API (OAuth 2.0) |
| Health | HealthKit (iOS) via react-native-health |
| Notifications | Expo Notifications + Firebase FCM |
| Calendar | Expo Calendar (iCloud / Google) |
| UI | Glassmorphism, Expo Linear Gradient, Expo Blur |

---

## Architecture

```
orial/
├── app/
│   ├── (tabs)/          # Tab screens: Dashboard, Daily, Gym, Finance, Settings
│   ├── onboarding/      # First-run flow
│   ├── settings/        # Notion, Calendar, Jarvis sub-screens
│   └── whoop/           # OAuth callback handler
├── src/
│   ├── components/      # GlassCard, charts, modals, sheets
│   ├── services/        # One service per domain (auth, WHOOP, hydration, gym…)
│   ├── repositories/    # Data access layer (Drizzle queries)
│   └── context/         # AuthContext
├── drizzle/
│   ├── schema.ts        # Single source of truth for all tables
│   └── migrations/      # Auto-generated SQL migrations
└── assets/              # Icons, splash screens
```

No backend. The app talks directly to external APIs (WHOOP, Notion, Firebase) from the client. All user data lives in local SQLite or user-controlled services.

---

## Getting Started

### Prerequisites

- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go or a dev build for device testing

### Install

```bash
git clone https://github.com/teijeiro7/orial.git
cd orial
npm install
```

### Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:

```env
# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=

# Google OAuth
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=

# WHOOP
EXPO_PUBLIC_WHOOP_CLIENT_ID=
EXPO_PUBLIC_WHOOP_CLIENT_SECRET=

# Openclaw AI (optional)
EXPO_PUBLIC_OPENCLAW_ENDPOINT=
```

### Run

```bash
# Start Expo dev server
npm start

# iOS
npm run ios

# Android
npm run android
```

### Database

```bash
# Generate new migration after schema changes
npm run db:generate

# Push schema to local SQLite
npm run db:push
```

### Tests

```bash
npm test
```

Unit tests use Jest with the `jest-expo` preset (`*.test.ts` next to the code
under test). The Supabase client is mocked, so tests run offline and fast.

---

## Supabase (cloud backend & sync)

The app is offline-first: it always reads and writes local SQLite first, then
syncs to Supabase in the background (last-write-wins on a per-table timestamp).
Jarvis (the server agent) reads and writes the same Supabase tables directly.

The code ships ready to use — it just needs a Supabase project. The app does
**not** crash when credentials are missing or still placeholders; sync simply
stays disabled until real values are provided.

### One-time manual setup

1. **Create a project** at [supabase.com](https://supabase.com) (this cannot be
   automated — it needs the dashboard).
2. **Run the migration**: open the project's SQL editor and paste
   [`supabase/migrations/001_initial.sql`](./supabase/migrations/001_initial.sql)
   (or `supabase db push` with the CLI). It creates every table plus the
   `progress-photos` storage bucket.
3. **Fill `.env`** with the values from *Project Settings → API*:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   ```

   The anon key is public-safe by design. The `EXPO_PUBLIC_` prefix is required
   for the value to be readable at runtime via `process.env`.
4. **(Optional) migrate existing local data** to the cloud by calling
   `migrateLocalToSupabase()` once (`src/services/migrateLocalToSupabase.ts`).
   It is idempotent (upsert by primary key) and guarded by a run-once flag.

### How Jarvis accesses the data

Jarvis connects to the same Supabase project **server-side** using the
`service_role` key (never shipped in the app). That key bypasses RLS, so the
agent can read all tables to generate insights and write to `insight_logs`.
The app and Jarvis stay decoupled: neither depends on the other's sync loop.

> **Security note:** RLS is intentionally left disabled for this single-user
> setup (app uses the anon key, Jarvis uses `service_role`). Before going
> multi-user, add a `user_id` column and per-user RLS policies — see the notes
> at the bottom of `001_initial.sql`.

---

## Design System

Dark-first glassmorphism UI with a deep violet palette:

| Token | Value |
|---|---|
| Background | `#0A0A1A` |
| Surface | Semi-transparent dark glass |
| Accent | Violet `#7C3AED` |
| Success | Emerald `#10B981` |
| Warning | Amber `#F59E0B` |
| Error | Rose `#EF4444` |
| Typography | Inter |

---

## Security

- Credentials stored in Expo SecureStore (Keychain / Keystore)
- Firebase Auth tokens managed server-side
- No credentials committed to source — use environment variables
- Biometric gate on app open (optional)

---

## License

Private — all rights reserved.
