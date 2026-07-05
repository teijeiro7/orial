# Hermes ↔ Orial: WHOOP Screenshot OCR Spec

> **Status**: Draft — for implementation on the Hermes side.
> **Owner**: You (separate workstream, does NOT touch the Orial codebase).
> **Orial side**: Already implemented. The `whoop_extras` table + `whoop_extra` inbox dispatcher consume whatever payloads you produce.

---

## 1. Context

The WHOOP REST API used by Orial (`whoopService.ts`) only gives daily aggregates
(recovery, HRV, RHR, SpO2, sleep performance/duration, etc.). A lot of useful
WHOOP data — **continuous heart rate**, **stress monitor**, **sleep architecture
with timestamps**, **health monitor**, **target strain**, **journal** — is only
visible in the WHOOP mobile app.

We already use Hermes to parse WHOOP screenshots for the Gym tab (you POST
workout screenshots to Hermes in Telegram, Hermes parses the JSON out and the
workout is delivered to Orial's generic inbox). This spec extends the same
mechanism to other WHOOP screens.

**You do not need to touch Orial.** You produce the payloads, POST them to
your Hermes server's `/inbox/publish` endpoint, and Orial picks them up on
its next poll.

---

## 2. Server contract (what Hermes must implement)

Orial polls this endpoint every ~5 min (foreground) and via background fetch
(~15 min):

```
GET {ORIAL_HERMES_URL}/inbox/pending
→ 200 [{ "id": "...", "type": "whoop_extra", "payload": {...}, "createdAt": "..." }]
→ 204 No Content (nothing pending)

DELETE {ORIAL_HERMES_URL}/inbox/{id}
→ 200/204 (Orial calls this after successfully consuming the item)
```

The `id` must be **stable and unique per item** (Orial uses it for
idempotency — re-pulling the same id is a no-op).

### 2.1 Publishing API (Hermes → server)

Add a server endpoint Hermes can call when it finishes parsing a screenshot:

```
POST {ORIAL_HERMES_URL}/inbox/publish
Content-Type: application/json
{
  "type": "whoop_extra",
  "payload": { ... }   // see Section 3
}
```

The server assigns an `id` and `createdAt`, returns the enqueued item.

---

## 3. WHOOP `whoop_extra` payload schema

All WHOOP screenshots map to this single inbox type. The `source` field
identifies which WHOOP screen the data came from so Orial can render it
appropriately.

```ts
{
  "date": "YYYY-MM-DD",            // local date the screenshot was taken
  "source": "sleep_detail" | "stress" | "health_monitor" | "target_strain" | "journal" | "workout_detail",
  "capturedAt": "2025-06-26T08:14:00Z",  // ISO; defaults to now() if omitted
  "data": { ... }                  // source-specific, see below
}
```

### 3.1 `sleep_detail` — WHOOP Sleep tab detail

Visible data the API does NOT expose: per-stage timeline, sleep coach
recommendation, sleep debt, efficiency, consistency, disturbances.

```jsonc
{
  "source": "sleep_detail",
  "date": "...",
  "data": {
    "inBedStart": "23:42",
    "inBedEnd": "07:08",
    "totalInBedMin": 446,

    // Stages with durations in minutes
    "stages": {
      "awake": 24,
      "light": 218,
      "rem": 96,
      "deep": 78
    },

    // Optional, if visible on the screen
    "sleepCoachNeedHours": 8.2,        // WHOOP's recommended sleep need
    "sleepDebtHours": 1.4,             // rolling debt
    "efficiencyPct": 91,                // % of time in bed actually asleep
    "consistencyPct": 87,               // WHOOP consistency vs user's baseline
    "disturbances": 3,                  // number of awakenings

    // Optional raw samples if WHOOP shows a graph (only capture top/bottom peaks)
    "hrSamples": [
      // [{ "t": "23:42", "bpm": 52 }, { "t": "00:15", "bpm": 48 }, ...]
    ]
  }
}
```

### 3.2 `stress` — WHOOP Stress Monitor

**Zero in the WHOOP REST API.** Continuous stress score + balance score.

```jsonc
{
  "source": "stress",
  "date": "...",
  "data": {
    "currentStress": 42,                // 0-100, current stress level
    "avgStress": 38,
    "maxStress": 71,
    "minStress": 12,
    "balance": "balanced",              // "balanced" | "stressed" | "recovered"
    "recoveryBalanceScore": 64,         // 0-100 if shown
    "highStressMinutes": 142,           // minutes spent in high-stress zones
    "lowStressMinutes": 388,
    "mediumStressMinutes": 320
  }
}
```

### 3.3 `health_monitor` — WHOOP Health Monitor (continuous vitals)

**Zero in the WHOOP REST API.** WHOOP band samples written to its own app.

```jsonc
{
  "source": "health_monitor",
  "date": "...",
  "data": {
    "spo2": {
      "avgPct": 96.4,
      "minPct": 93.1,
      "maxPct": 98.2,
      // Optional: hourly buckets
      "hourly": [
        { "hour": 0, "avg": 96.8 },
        { "hour": 1, "avg": 96.5 }
      ]
    },
    "skinTempC": {
      "avg": 33.4,
      "baselineDelta": 0.3
    },
    "respiratoryRate": {
      "avgBpm": 14.2,
      "minBpm": 12.0,
      "maxBpm": 17.5
    }
  }
}
```

### 3.4 `target_strain` — WHOOP Strain Coach

**Zero in the WHOOP REST API.** WHOOP's recommended strain for the day.

```jsonc
{
  "source": "target_strain",
  "date": "...",
  "data": {
    "targetStrainLow": 8.5,            // lower bound
    "targetStrainHigh": 13.5,          // upper bound
    "currentStrain": 6.2,              // what's accumulated so far (if visible)
    "explanation": "Based on 73% recovery and 0.8h sleep debt, aim for moderate effort."
  }
}
```

### 3.5 `journal` — WHOOP Journal entries + their impact

Behaviors logged in WHOOP that affect recovery (alcohol, late meals, caffeine,
meditation, supplements, etc.).

```jsonc
{
  "source": "journal",
  "date": "...",
  "data": {
    "entries": [
      { "type": "alcohol", "units": 2, "impactPct": -8, "loggedAt": "20:30" },
      { "type": "caffeine", "mg": 180, "loggedAt": "08:00" },
      { "type": "late_meal", "loggedAt": "22:15" },
      { "type": "meditation", "minutes": 15, "loggedAt": "07:30" },
      { "type": "supplement", "name": "creatine", "mg": 5000, "loggedAt": "08:00" }
    ],
    "netRecoveryImpactPct": -8         // WHOOP's overall impact if visible
  }
}
```

### 3.6 `workout_detail` — WHOOP Workout detail

Richer than the workout API: HR zone breakdown with time-in-zone, splits,
elevation, perceived effort.

```jsonc
{
  "source": "workout_detail",
  "date": "...",
  "data": {
    "activityName": "Push",
    "durationMin": 58,
    "strain": 14.2,
    "avgHr": 142,
    "maxHr": 178,
    "kilojoule": 2450,
    "zones": { "z1": 8, "z2": 32, "z3": 18, "z4": 0, "z5": 0 },   // % time
    "splits": [                          // km or 5-min splits, whichever WHOOP shows
      { "label": "5", "pace": "5:42", "hr": 145 },
      { "label": "10", "pace": "5:38", "hr": 148 }
    ],
    "perceivedEffort": 7,                // 0-10 if logged
    "elevationGainM": 84
  }
}
```

---

## 4. Hermes behaviour (suggested)

In the Telegram chat, you already have access to the WHOOP screenshots. The
flow you build on the Hermes side:

1. User sends a WHOOP screenshot in Telegram.
2. Hermes classifies the screenshot (vision model + which screen it is).
3. Hermes extracts the visible metrics per the schema above.
4. Hermes POSTs the typed payload to your `/inbox/publish` endpoint.
5. Orial picks it up on the next poll (≤5 min foreground, ≤15 min background).

For the screenshot classification you can use a small system prompt like:

```
You are parsing a WHOOP mobile-app screenshot.

Classify the screen into one of:
  - sleep_detail   (WHOOP Sleep tab, detail view)
  - stress         (WHOOP Stress Monitor)
  - health_monitor (WHOOP Health Monitor tab)
  - target_strain  (WHOOP Strain Coach / Strain target)
  - journal        (WHOOP Journal entries)
  - workout_detail (WHOOP Workout detail view)

Then return a JSON object matching the schema at:
  {HERMES_REPO}/.planning/HERMES-WHOOP-OCR-SPEC.md
  (link the user to this file in your system context)
```

---

## 5. Example Telegram interaction

```
User: [sends WHOOP Sleep detail screenshot]
      date was 2025-06-26

Hermes: Sleep detail captured. 446 min in bed, 24 awake,
        218 light, 96 REM, 78 deep. Sleep coach wanted
        8.2h, you got 7.4h. Sleep debt now 1.4h. 
        Orial will pick it up in a few minutes.
```

Internally Hermes POSTs to `/inbox/publish` with `source: sleep_detail`.

---

## 6. Versioning

If a schema field changes, add it as **optional**. Never rename or remove
existing fields — Orial ignores unknown fields and might be on an older
version. Bump the version in your own system context if you make a
breaking change (Orial side: dispatcher will mark the item as `error` if
required fields are missing, and ack it server-side so it doesn't loop).

---

## 7. Testing without screenshots

You can POST a payload directly to `/inbox/publish` from `curl` to test
the end-to-end flow without taking a screenshot:

```bash
curl -X POST http://localhost:8642/inbox/publish \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "whoop_extra",
    "payload": {
      "date": "2025-06-26",
      "source": "sleep_detail",
      "data": {
        "inBedStart": "23:42",
        "inBedEnd": "07:08",
        "totalInBedMin": 446,
        "stages": { "awake": 24, "light": 218, "rem": 96, "deep": 78 }
      }
    }
  }'
```

Then in Orial: open the app (or wait for the next background poll). Check
the `whoop_extras` table to see your row.

---

## 8. Open questions

- **Continuous HR samples**: WHOOP band records HR continuously. Capturing
  every sample in a screenshot is impossible. The `hrSamples` field in
  `sleep_detail` is a low-fidelity capture; the high-fidelity version would
  need WHOOP to export the data (not available via screenshots).
- **Orial UI**: Orial currently just stores the data. The UI to surface
  this is a follow-up — most of it would go on a new "Forge detail" tab
  showing the per-stage sleep graph, stress timeline, etc. Out of scope
  for the inbox integration.
