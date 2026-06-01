# Gym Tab — Rediseño Completo

## 1. Concept & Vision

Apple Health meets WHOOP: interfaz densa, técnica y sin adornos. El usuario no interactúa manualmente — todo viene de Hermes vía screenshot de WHOOP. La app es puro tracking: visualización precisa, progresión clara, datos duros. Sensación de instrumento de precisión, no de motivational fitness app.

---

## 2. Design Language

### Aesthetic Direction
**Referencia:** Apple Health + WHOOP — no gradients, no decorative elements, typography técnico, monospace para números, espaciado denso pero breathable.

### Color Palette
```
Background:      #080C18  (deepNavy — igual que el resto de la app)
Surface:          #0D1B2A  (darkBlue — cards/containers)
Surface Elevated: #111827  (surface — elevación sutil)
Border:           rgba(255,255,255,0.07)
Border Strong:    rgba(255,255,255,0.13)

Text Primary:     #F1F5F9
Text Secondary:   #94A3B8
Text Muted:       #4B5563

Accent (primary): #10B981 (success green — marca WHOOP)
Accent Alt:       #06B6D4 (cyan — HR/zonas)
Warning:          #F59E0B
Error:            #EF4444

Zone colors (HR):
  Zone 1 (Recovery): #64748B
  Zone 2 (Aerobic):   #22C55E
  Zone 3 (Threshold): #F59E0B
  Zone 4 (VO2max):   #EF4444
  Zone 5 (Anaerobic): #DC2626
```

### Typography
- **Display/Headers:** Inter-SemiBold, tracking -0.3, tight
- **Body:** Inter-Regular, 15px
- **Numbers/Metrics:** Inter con `fontVariant: ['tabular-nums']` — todo en monospace feel
- **Labels:** Inter-Medium, 10-11px, UPPERCASE, letter-spacing 1

### Spatial System
- Padding base: 16px horizontal, 12px vertical
- Gaps: 8px entre elementos relacionados, 16px entre secciones
- Cards: border-radius 12px, border 1px
- Touch targets: mínimo 44px height

### Motion Philosophy
- Mínimo animation — solo feedback funcional
- Press states: scale(0.97) con 100ms ease-out
- Skeleton loading para data
- No decorative animations

---

## 3. Layout & Structure

### Tab Structure (3 secciones en scroll vertical)

```
┌─────────────────────────────────┐
│ GYM                    [icon+] │  <- Header minimal
├─────────────────────────────────┤
│ ████ HOY ████                   │  <- Section label
│ ┌─────────────────────────────┐ │
│ │ ● SESIÓN                    │ │  <- Active session card
│ │ Press Banca · 4 series       │ │     o empty state
│ │ 12.5kJ · 58min · 142bpm avg │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ ████ SESIONES ████              │
│ ┌─────────────────────────────┐ │
│ │ 28 may 2025      14.2 ████  │ │  <- Dense list
│ │ Press Banca          4 sets │ │     Fecha | Strain bar | Info
│ │ Peso muerto          5 sets │ │
│ ├─────────────────────────────┤ │
│ │ 27 may 2025      11.8 ██    │ │
│ │ Sentadilla          6 sets   │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ ████ RUTINAS ████               │
│ ┌─────────────────────────────┐ │
│ │ Press Banca           [···] │ │  <- Options menu (edit/delete)
│ │ 4 ejercicios · 2 sesiones   │ │
│ ├─────────────────────────────┤ │
│ │ Sentadilla            [···] │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Responsive Strategy
- Mobile only (móvil confirmado)
- Single column, max-width none — full width
- Touch-optimized, no hover states relevantes

---

## 4. Features & Interactions

### 4.1 Sesión Activa (Hoy)
- Si hay sesión WHOOP parseada por Hermes → muestra card activa
- Card muestra: nombre rutina, ejercicios completados, stats (kJ, duración, HR avg)
- Tap → expande a detalle de sesión (ejercicios + sets)
- Si no hay sesión hoy → empty state "Sin sesión hoy"

### 4.2 Historial de Sesiones
- Lista densa invertida (más reciente primero)
- Cada item: fecha, strain score (bar visualization), rutina, número exercises
- Tap → expande detalle completo
- Pull-to-refresh (por si Hermes grabó algo nuevo)

### 4.3 Detalle de Sesión (expandido)
```
┌─────────────────────────────┐
│ Press Banca                 │
│ 28 may 2025 · 58min         │
├─────────────────────────────┤
│ ████ STRAIN 14.2 ████       │  <- Visual strain bar
│ 245 kJ · 142 bpm avg        │
│ Zonas: 32% Z2 · 18% Z3      │
├─────────────────────────────┤
│ Press Banca                  │
│   S1: 8 reps × 80kg         │
│   S2: 8 reps × 80kg         │
│   S3: 6 reps × 80kg         │  <-última S4 incompleta
│   S4: 4 reps × 80kg (x)     │
├─────────────────────────────┤
│ Peso Muerto                  │
│   S1: 5 reps × 120kg        │
│   ...                       │
└─────────────────────────────┘
```

### 4.4 Rutinas (gestión)
- Lista de rutinas disponibles (creadas por Hermes desde sesiones WHOOP)
- Tap → expande para ver ejercicios que contiene
- Long press / menú → edit name, delete
- "+" button → crear rutina manual (edge case)

### 4.5 Hermes Integration (background)
- Hermes parsea screenshot WHOOP → gymService.createSessionFromHermes()
- Crea: GymSession + GymExercise + GymSet para cada ejercicio
- Si rutina no existe → crear automáticamente desde sport_name

### 4.6 Progresión
- Desde detalle de ejercicio → tab "Histórico" ver pesos por fecha
- Visualización: línea o lista densa fecha → peso
- Filtrar por periodo: 1 mes, 3 meses, todo

---

## 5. Component Inventory

### SessionCard (activo)
- **Default:** background surface, border, flex row
- **With data:** shows name, exercise count, kJ, duration, HR
- **Empty:** "Sin sesión hoy" con icono dumbbell

### SessionListItem
- **Default:** dense row, fecha | strain bar | rutina | exercise count
- **Pressed:** scale 0.97, slight opacity change
- **Expanded:** reveals full exercise list with sets

### RoutineCard
- **Default:** name, exercise count, session count
- **Expanded:** shows exercise list
- **Menu:** overflow icon → edit/delete

### StrainBar
- Horizontal bar, width proportional to strain (0-21 scale → 0-100%)
- Color gradient verde → amarillo → rojo basado en strain

### ZoneBadge
- Small pill showing zone + percentage
- Color coded per zone

### ExerciseBlock (within session detail)
- Exercise name (bold)
- Sets list: monospace, reps × weight
- Incomplete set indicator (if applicable)

### ProgressChart (progresión)
- Line chart or dense list view
- Date + weight per entry
- Trend indicator (↑↓)

### EmptyState
- Icon + title + subtitle
- Centered, generous padding

### LoadingState
- Skeleton blocks matching content dimensions
- Shimmer animation (subtle)

---

## 6. Technical Approach

### Data Model (existing, no changes needed)

```typescript
// GymSession from WHOOP
interface GymSession {
  id: string
  routineId: string      // links to routine (sport_name)
  date: string           // YYYY-MM-DD
  strainScore: number    // from WHOOP
  kilojoule: number      // from WHOOP
  durationMin: number    // calculated from start/end
  avgHeartRate: number   // from WHOOP
  zones: {               // parsed from WHOOP HR zones
    z1: number           // percentage
    z2: number
    z3: number
    z4: number
    z5: number
  }
  notes?: string
  createdAt: Date
}

// GymExercise
interface GymExercise {
  id: string
  routineId: string
  name: string
  targetSets: number
  targetRepsMin: number
  targetRepsMax: number
  currentWeightKg: number
  incrementKg: number
  orderIndex: number
}

// GymSet
interface GymSet {
  id: string
  sessionId: string
  exerciseId: string
  setNumber: number
  reps: number
  weightKg: number
}
```

### Service Layer (gymService updates)

```typescript
// New methods needed:
gymService.createSessionFromHermes(data: {
  routineName: string      // sport_name from WHOOP
  date: string
  strainScore: number
  kilojoule: number
  durationMin: number
  avgHeartRate: number
  zones: { z1,z2,z3,z4,z5 }
  exercises: Array<{
    name: string
    sets: Array<{ reps: number; weightKg: number }>
  }>
})

gymService.getSessionsForDateRange(start: string, end: string): GymSession[]

gymService.getExerciseHistory(exerciseId: string, limit?: number): Array<{
  date: string
  weightKg: number
  reps: number
}>

gymService.getRoutineProgress(routineId: string, months: number): ProgressionData[]
```

### File Structure
```
app/(tabs)/gym.tsx              # Main screen (refactor completo)
src/services/gymService.ts      # Updated service layer
src/components/gym/
  SessionCard.tsx
  SessionListItem.tsx
  RoutineCard.tsx
  StrainBar.tsx
  ZoneBadge.tsx
  ExerciseBlock.tsx
  ProgressChart.tsx
  EmptyState.tsx
  SkeletonLoader.tsx
```

### State Management
- Local useState para UI state (expanded items, active tab)
- No global state needed — data flows through service layer
- useCallback for data fetching

---

## 7. Implementation Priority

1. **Phase 1:** New UI skeleton (3 sections, no data)
2. **Phase 2:** Data fetching + display (sessions, routines)
3. **Phase 3:** Session detail view + exercise blocks
4. **Phase 4:** Hermes integration (createSessionFromHermes)
5. **Phase 5:** Progresión chart