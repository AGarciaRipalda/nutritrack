# Metabolic iOS Native App — Design Specification

## Overview

Native SwiftUI iOS app for the Metabolic nutrition & fitness platform. Replicates the UI design from screenshots of the existing web app, built as a standalone Xcode project separate from the Capacitor-based hybrid app.

## Goals

- Pixel-faithful replication of the existing app UI design
- iOS 26 Liquid Glass aesthetic (`.glassEffect()` modifier throughout)
- Connect to existing FastAPI backend at `api.metabolic.es` (no auth required)
- 5-tab bottom navigation matching the web app

## Non-Goals

- Replacing or modifying the existing Capacitor/Next.js app
- Offline/cache support (always fetches fresh data)
- Authentication layer
- Push notifications (v1)

## Project Location

`nutrition_frontend/ios-native/` — new standalone Xcode project named `Metabolic`

## Architecture

Pattern: MVVM

- **Views**: SwiftUI declarative views
- **ViewModels**: `@Observable` classes, own async state management
- **Services**: `APIClient` singleton (URLSession + async/await)
- **Models**: `Codable` structs matching backend JSON responses

## Tech Stack

- Swift 6
- SwiftUI
- iOS 26 minimum deployment target
- Swift Charts (for weight evolution chart)
- URLSession + async/await (no external networking libraries)
- No external dependencies

## File Structure

```
Metabolic/
├── App/
│   └── MetabolicApp.swift
├── Core/
│   ├── Network/
│   │   ├── APIClient.swift         # Base URL, shared URLSession
│   │   └── Endpoints.swift         # All endpoint definitions
│   └── Models/
│       ├── UserProfile.swift
│       ├── NutritionModels.swift
│       ├── WorkoutModels.swift
│       └── ProgressModels.swift
├── Features/
│   ├── Panel/
│   │   ├── PanelView.swift
│   │   └── PanelViewModel.swift
│   ├── Dieta/
│   │   ├── DietaView.swift
│   │   └── DietaViewModel.swift
│   ├── Entreno/
│   │   ├── EntrenoView.swift
│   │   └── EntrenoViewModel.swift
│   ├── Progreso/
│   │   ├── ProgresoView.swift
│   │   └── ProgresoViewModel.swift
│   └── Ajustes/
│       ├── AjustesView.swift
│       └── AjustesViewModel.swift
└── Shared/
    ├── Components/
    │   ├── GlassCard.swift          # Reusable card with .glassEffect()
    │   ├── PillButton.swift         # Pill-shaped button with glass
    │   └── MetricBadge.swift        # Icon + value display widget
    ├── DesignSystem.swift            # Colors, typography, spacing constants
    └── Extensions/
        └── Color+Brand.swift         # Brand color definitions
```

## Design System

### Colors

| Role | Value |
|------|-------|
| Brand accent | `#44D7A8` (eucalyptus green) |
| Accent pressed | `#2DB889` |
| Background | `systemGroupedBackground` |
| Glass cards | `#44D7A8` at 8% opacity + blur |
| Dashboard kcal | `#FF9500` (orange) |
| Dashboard steps | `#44D7A8` (brand green) |
| Dashboard time | `#FFCC00` (yellow) |
| Dashboard bpm | `#FF3B30` (red) |
| CTA buttons | `#44D7A8` |
| Tags/chips | `#44D7A8` at 15% opacity, text in accent |

### Typography

All SF Pro (system font):

- Large titles: `.largeTitle` bold
- Section headers: `.headline`
- Body: `.body`
- Captions: `.caption`

### Liquid Glass Strategy

- **Tab bar**: automatic iOS 26 liquid glass
- **Cards** (Panel, Progreso, Entreno): `.glassEffect()` with rounded corners (16pt)
- **Pill buttons** (IA, Importar, Nuevo, Generar plan): `.glassEffect()` with green tint; use `.clipShape(Capsule())`, height 36pt
- **Settings Form**: native iOS 26 `Form` with glass grouped style
- **Background**: `systemGroupedBackground` (new iOS 26 material base)

## Screens

### 1. Panel (Dashboard) — `GET /dashboard`

- Navigation bar: title "Panel", date subtitle, goal chip top-right
- **Card 1 — Calories**: circular remaining indicator + macros row (Proteína, Carbos, Grasas)
- **Card 2 — Actividad**: 4 metrics in a row (kcal orange, pasos green, min yellow, bpm red)
- **Card 3 — Balance**: list rows (Ingesta, Meta, Gasto activo, Diferencia)
- Motivational banner at bottom (when no meals logged)

### 2. Dieta (Diet) — `GET /diet/today`, `GET /diet/weekly`

- Title "Dieta" + consumed kcal subtitle
- "Generar plan" pill button (top right, green, AI icon)
- Segmented control: "Plan diario" / "Plan semanal"
- **Empty state**: icon + "Sin comidas planificadas" + helper text
- **Loaded state**: meal cards grouped by type (desayuno, almuerzo, cena, snacks)
- Regenerate: `POST /diet/today/regenerate`

### 3. Entreno (Workout) — `GET /v2/training/workouts`, `GET /v2/training/routines`

- Title "Entreno" + sessions today subtitle
- Action pills (functional):
  - **"IA"**: generates a workout using AI — calls `POST /v2/training/routines` with AI-generated parameters, then starts the session
  - **"Importar"**: imports from gym history — calls `GET /exercise/gym-history`
  - **"Nuevo"**: creates a blank new workout session — calls `POST /v2/training/workouts`
- Section "RECIENTES": workout rows with glass card
  - Each row: AI icon, name, duration, kcal burned, delete button, chevron

### 4. Progreso (Progress) — `GET /weight/history`

- Title "Progreso" + "+ Registrar" button
  - Tapping "+ Registrar" opens a sheet/modal with two fields:
    - **Weight (kg)**: decimal stepper or text field
    - **Date**: `DatePicker`
  - On confirm, calls `POST /weight` with the entered values
- "Seguimiento de peso" section header
- Current weight card: weight value + delta + date
- "Evolución" section: Swift Charts line chart (date X axis, weight Y axis)
- "Historial" section: list of weight entries with date

### 5. Ajustes (Settings) — `GET /profile`, `GET /preferences`

- Title "Ajustes — Perfil y preferencias"
- **Section Apariencia**: light/dark mode toggle
- **Section Información personal**: Nombre (text field), Género (picker), Edad/Altura/Peso (steppers)
- **Section Objetivos**: Meta picker (Perder peso / Mantener / Ganar músculo), Actividad picker
- **Section Macros**: Calorías/día, Proteína, Carbos, Grasas (steppers)
- **Section Preferencias alimentarias**:
  - Excluidos (alergias): tag chips + add field
  - Favoritos: tag chips + add field
  - No me gusta: tag chips + add field
- "Guardar ajustes" green CTA button (`PUT /profile` + `PUT /preferences`)

## Data Flow

```
View .task { await viewModel.load() }
  → ViewModel calls APIClient.get(endpoint)
  → APIClient executes URLRequest via URLSession
  → Response decoded as Codable model
  → ViewModel @Published state updates
  → View re-renders
```

ViewModel state pattern:

```swift
enum ViewState<T> {
    case idle
    case loading
    case loaded(T)
    case error(String)
}
```

## API Endpoints Summary

| Screen | Method | Endpoint |
|--------|--------|----------|
| Panel | GET | `/dashboard` |
| Dieta | GET | `/diet/today` |
| Dieta | GET | `/diet/weekly` |
| Dieta regenerate | POST | `/diet/today/regenerate` |
| Entreno | GET | `/v2/training/workouts` |
| Entreno | GET | `/v2/training/routines` |
| Entreno IA | POST | `/v2/training/routines` |
| Entreno Importar | GET | `/exercise/gym-history` |
| Entreno Nuevo | POST | `/v2/training/workouts` |
| Progreso | GET | `/weight/history` |
| Progreso log | POST | `/weight` |
| Ajustes read | GET | `/profile` |
| Ajustes read | GET | `/preferences` |
| Ajustes save | PUT | `/profile` |
| Ajustes save | PUT | `/preferences` |

**Base URL**: `https://api.metabolic.es`

## Client-Side Calculations (display only)

```swift
var restantes: Int { meta - consumidas }
var diferencia: Int { ingesta - meta + gastoActivo }
```

All nutritional and caloric values come pre-calculated from the backend.

## Tab Bar

Native SwiftUI `TabView` with 5 tabs (automatic liquid glass in iOS 26):

| # | Label | Icon |
|---|-------|------|
| 1 | Panel | grid |
| 2 | Dieta | fork/knife |
| 3 | Entreno | figure.run |
| 4 | Progreso | chart.line.uptrend.xyaxis |
| 5 | Ajustes | gear |
