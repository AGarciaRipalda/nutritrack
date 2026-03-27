# Fix iOS Models — Adapt to Real Backend API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all Swift Codable models and views so they decode the real API responses without error, making the app fully functional on real iPhone.

**Architecture:** The backend returns snake_case JSON with a structure that differs from the current Swift models (wrong field names, wrong types, wrong nesting). Each task fixes one file or tight group of files, verifying the app compiles after each change.

**Tech Stack:** Swift 5.9+, SwiftUI, `Codable`/`JSONDecoder`, Xcode 15+

**Verified API Response (GET /dashboard):**
```json
{
  "profile": {"name":"Usuario","gender":"male","age":36,"height_cm":170,"weight_kg":80.0,"activity_level":1,"goal":"maintain","week_start_day":0},
  "nutrition": {"bmr":1688,"tdee_ref":2025,"daily_target":2025,"macros":{"target_kcal":2025,"protein_g":160,"fat_g":80,"carb_g":166}},
  "exercise_data": {"burned_kcal":0,"adjustment_kcal":0,"exercises":[]},
  "today_health": null,
  "today_active_kcal": 438,
  "goal_balance": {"goal":"maintain","target_adjustment":0,"consumed_kcal":0,"active_kcal":438,"net_balance":-438,"target_net":1587},
  "today_training": {},
  "alerts": [],
  "session_has_exercise": false
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `Metabolic/Core/Models/NutritionModels.swift` | Rebuild 4 structs to match real API |
| `Metabolic/Core/Models/UserProfile.swift` | `activityLevel: String → Int` |
| `Metabolic/Features/Panel/PanelViewModel.swift` | Fix `restantes` and `diferencia` computed vars |
| `Metabolic/Features/Panel/PanelView.swift` | Fix 7 computed vars that read wrong fields |
| `Metabolic/Features/Ajustes/AjustesViewModel.swift` | `activityLevel: String → Int`, fix `ProfilePayload` |
| `Metabolic/Features/Ajustes/AjustesView.swift` | Change Picker tags from String to Int |

---

## Task 1: Fix NutritionModels.swift

**Files:**
- Modify: `nutrition_frontend/ios-native/Metabolic/Core/Models/NutritionModels.swift`

### Root causes in this file:
1. `DashboardResponse.CodingKeys.nutritionData = "nutrition_data"` → API sends `"nutrition"` → always nil
2. `NutritionData` expects flat fields but API has nested `macros` object; `carbs_g` spelled wrong (`"carbs_g"` vs `"carb_g"`)
3. `ExerciseData` has non-optional `steps: Int` and `activeMinutes: Int` → NOT in API → `keyNotFound` crash
4. `GoalBalance` fields (`intake`, `target`, `activeExpenditure`, `difference`) → none exist in API → `keyNotFound` crash
5. `WeightData` is mapped in `DashboardResponse` but never returned by dashboard endpoint

- [x] **Step 1: Replace NutritionModels.swift entirely**

```swift
import Foundation

// MARK: — Dashboard

struct DashboardResponse: Codable, Sendable {
    let nutritionData: NutritionData?
    let exerciseData: ExerciseData?
    let goalBalance: GoalBalance?

    enum CodingKeys: String, CodingKey {
        case nutritionData = "nutrition"         // API key is "nutrition", not "nutrition_data"
        case exerciseData = "exercise_data"
        case goalBalance = "goal_balance"
    }
}

// Maps to dashboard "nutrition" object: {"bmr":…,"daily_target":…,"macros":{…}}
struct NutritionData: Codable, Sendable {
    let dailyTarget: Int
    let macros: MacroData

    enum CodingKeys: String, CodingKey {
        case dailyTarget = "daily_target"
        case macros
    }

    // Convenience computed vars — keep view code unchanged
    var targetKcal: Int    { macros.targetKcal }
    var proteinG: Double   { macros.proteinG }
    var carbsG: Double     { macros.carbG }   // API field is "carb_g", view uses carbsG
    var fatG: Double       { macros.fatG }
}

struct MacroData: Codable, Sendable {
    let targetKcal: Int
    let proteinG: Double
    let carbG: Double
    let fatG: Double

    enum CodingKeys: String, CodingKey {
        case targetKcal = "target_kcal"
        case proteinG   = "protein_g"
        case carbG      = "carb_g"
        case fatG       = "fat_g"
    }
}

// Maps to dashboard "exercise_data": {"burned_kcal":0,"adjustment_kcal":0,"exercises":[]}
// steps/activeMinutes/bpm are NOT returned by the backend yet — kept Optional for future Apple Health sync
struct ExerciseData: Codable, Sendable {
    let burnedKcal: Int
    let adjustmentKcal: Int
    let steps: Int?
    let activeMinutes: Int?
    let bpm: Int?

    enum CodingKeys: String, CodingKey {
        case burnedKcal      = "burned_kcal"
        case adjustmentKcal  = "adjustment_kcal"
        case steps
        case activeMinutes   = "active_minutes"
        case bpm
    }
}

// Maps to dashboard "goal_balance": {"consumed_kcal":0,"active_kcal":438,"net_balance":-438,"target_net":1587,…}
struct GoalBalance: Codable, Sendable {
    let consumedKcal: Int
    let activeKcal: Int
    let netBalance: Int
    let targetNet: Int

    enum CodingKeys: String, CodingKey {
        case consumedKcal = "consumed_kcal"
        case activeKcal   = "active_kcal"
        case netBalance   = "net_balance"
        case targetNet    = "target_net"
    }
}

// MARK: — Diet

struct Meal: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let mealType: String
    let kcal: Int
    let proteinG: Double
    let carbsG: Double
    let fatG: Double

    enum CodingKeys: String, CodingKey {
        case id, name, kcal
        case mealType = "meal_type"
        case proteinG = "protein_g"
        case carbsG   = "carbs_g"
        case fatG     = "fat_g"
    }
}

struct DietTodayResponse: Codable, Sendable {
    let meals: [Meal]
    let adherence: [String: Bool]?
    let stale: Bool?
}

struct DietWeeklyDay: Codable, Sendable {
    let date: String
    let meals: [Meal]
    let kcalTarget: Int

    enum CodingKeys: String, CodingKey {
        case date, meals
        case kcalTarget = "kcal_target"
    }
}

struct DietWeeklyResponse: Codable, Sendable {
    let days: [DietWeeklyDay]
}
```

- [x] **Step 2: Verify file saved correctly**

Open `NutritionModels.swift` and confirm:
- `DashboardResponse` has 3 fields (not 4)
- `nutritionData = "nutrition"` (not `"nutrition_data"`)
- `ExerciseData` has no required `steps` or `activeMinutes`
- `GoalBalance` has `consumedKcal`, `activeKcal`, `netBalance`, `targetNet`
- `WeightData` struct is GONE

- [x] **Step 3: Build project to check for compile errors**

In Xcode: Cmd+B or run `xcodebuild -scheme Metabolic -sdk iphonesimulator build 2>&1 | grep -E "error:|warning:" | head -30`

Expected: Errors in PanelViewModel.swift and PanelView.swift (because they reference the old `GoalBalance` fields). These will be fixed in Tasks 2 and 3.

---

## Task 2: Fix PanelViewModel.swift

**Files:**
- Modify: `nutrition_frontend/ios-native/Metabolic/Features/Panel/PanelViewModel.swift`

### Root causes in this file:
- `restantes` uses `nutrition.consumedKcal` (not in `nutrition` object) and `nutrition.targetKcal` (still works via computed var)
- `diferencia` uses `balance.intake - balance.target + balance.activeExpenditure` — none of those fields exist anymore

New mapping:
- `restantes` = `balance.targetNet - balance.consumedKcal` (remaining calories to reach adjusted daily target)
- `diferencia` = `balance.netBalance` (already computed by backend)

- [x] **Step 1: Replace PanelViewModel.swift**

```swift
import Foundation
import Observation

@MainActor
@Observable
final class PanelViewModel {
    var state: ViewState<DashboardResponse> = .idle

    var restantes: Int {
        guard case .loaded(let data) = state,
              let balance = data.goalBalance else { return 0 }
        return balance.targetNet - balance.consumedKcal
    }

    var diferencia: Int {
        guard case .loaded(let data) = state,
              let balance = data.goalBalance else { return 0 }
        return balance.netBalance
    }

    private let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, d MMM"
        formatter.locale = Locale(identifier: "es_ES")
        return formatter
    }()

    var todayDateString: String {
        dateFormatter.string(from: Date()).capitalized
    }

    func load() async {
        state = .loading
        do {
            let response: DashboardResponse = try await APIClient.shared.get(.dashboard)
            state = .loaded(response)
        } catch {
            state = .error(error.localizedDescription)
        }
    }
}
```

- [x] **Step 2: Build to check compile errors in PanelViewModel**

Expected: PanelViewModel compiles cleanly. Remaining errors are in PanelView.swift.

---

## Task 3: Fix PanelView.swift

**Files:**
- Modify: `nutrition_frontend/ios-native/Metabolic/Features/Panel/PanelView.swift`

### Root causes:
- `calorieProgress`: uses `nutrition.consumedKcal` → must use `balance.consumedKcal`
- `consumedLabel`: uses `nutrition.consumedKcal` → must use `balance.consumedKcal`
- `stepsValue`: uses `exercise.steps` (was `Int`, now `Int?`) → must unwrap
- `activeMinValue`: uses `exercise.activeMinutes` (was `Int`, now `Int?`) → must unwrap
- `ingestaValue`: uses `b.intake` → must use `b.consumedKcal`
- `metaValue`: uses `b.target` → must use `b.targetNet`
- `gastoValue`: uses `b.activeExpenditure` → must use `b.activeKcal`

Only these 7 computed vars change. The rest of the view is untouched.

- [x] **Step 1: Fix `calorieProgress`**

Old (lines 109–114):
```swift
private var calorieProgress: Double {
    guard case .loaded(let data) = viewModel.state,
          let nutrition = data.nutritionData,
          nutrition.targetKcal > 0 else { return 0 }
    return min(Double(nutrition.consumedKcal) / Double(nutrition.targetKcal), 1.0)
}
```

New:
```swift
private var calorieProgress: Double {
    guard case .loaded(let data) = viewModel.state,
          let nutrition = data.nutritionData,
          let balance = data.goalBalance,
          nutrition.targetKcal > 0 else { return 0 }
    return min(Double(balance.consumedKcal) / Double(nutrition.targetKcal), 1.0)
}
```

- [x] **Step 2: Fix `consumedLabel`**

Old (lines 120–124):
```swift
private var consumedLabel: String {
    guard case .loaded(let data) = viewModel.state,
          let nutrition = data.nutritionData else { return "0 / 0" }
    return "\(nutrition.consumedKcal) / \(nutrition.targetKcal)"
}
```

New:
```swift
private var consumedLabel: String {
    guard case .loaded(let data) = viewModel.state,
          let nutrition = data.nutritionData,
          let balance = data.goalBalance else { return "0 / 0" }
    return "\(balance.consumedKcal) / \(nutrition.targetKcal)"
}
```

- [x] **Step 3: Fix `stepsValue`**

Old (lines 193–197):
```swift
private var stepsValue: String {
    guard case .loaded(let data) = viewModel.state,
          let exercise = data.exerciseData else { return "0" }
    return "\(exercise.steps)"
}
```

New:
```swift
private var stepsValue: String {
    guard case .loaded(let data) = viewModel.state,
          let exercise = data.exerciseData else { return "0" }
    return "\(exercise.steps ?? 0)"
}
```

- [x] **Step 4: Fix `activeMinValue`**

Old (lines 199–203):
```swift
private var activeMinValue: String {
    guard case .loaded(let data) = viewModel.state,
          let exercise = data.exerciseData else { return "0" }
    return "\(exercise.activeMinutes)"
}
```

New:
```swift
private var activeMinValue: String {
    guard case .loaded(let data) = viewModel.state,
          let exercise = data.exerciseData else { return "0" }
    return "\(exercise.activeMinutes ?? 0)"
}
```

- [x] **Step 5: Fix `ingestaValue`**

Old (lines 253–257):
```swift
private var ingestaValue: String {
    guard case .loaded(let data) = viewModel.state,
          let b = data.goalBalance else { return "0 kcal" }
    return "\(b.intake) kcal"
}
```

New:
```swift
private var ingestaValue: String {
    guard case .loaded(let data) = viewModel.state,
          let b = data.goalBalance else { return "0 kcal" }
    return "\(b.consumedKcal) kcal"
}
```

- [x] **Step 6: Fix `metaValue`**

Old (lines 259–263):
```swift
private var metaValue: String {
    guard case .loaded(let data) = viewModel.state,
          let b = data.goalBalance else { return "0 kcal" }
    return "\(b.target) kcal"
}
```

New:
```swift
private var metaValue: String {
    guard case .loaded(let data) = viewModel.state,
          let b = data.goalBalance else { return "0 kcal" }
    return "\(b.targetNet) kcal"
}
```

- [x] **Step 7: Fix `gastoValue`**

Old (lines 265–269):
```swift
private var gastoValue: String {
    guard case .loaded(let data) = viewModel.state,
          let b = data.goalBalance else { return "+0 kcal" }
    return "+\(b.activeExpenditure) kcal"
}
```

New:
```swift
private var gastoValue: String {
    guard case .loaded(let data) = viewModel.state,
          let b = data.goalBalance else { return "+0 kcal" }
    return "+\(b.activeKcal) kcal"
}
```

- [x] **Step 8: Build — Panel should now compile clean**

Expected: No errors in Panel files.

---

## Task 4: Fix UserProfile.swift

**Files:**
- Modify: `nutrition_frontend/ios-native/Metabolic/Core/Models/UserProfile.swift`

### Root cause:
`activityLevel: String` but API returns `"activity_level": 1` (Int) → `typeMismatch` error when decoding `/profile` → Ajustes screen shows "Error al cargar".

- [x] **Step 1: Change `activityLevel` type to `Int`**

Old:
```swift
struct UserProfile: Codable, Sendable {
    let name: String
    let gender: String
    let age: Int
    let heightCm: Int
    let weightKg: Double
    let activityLevel: String
    let goal: String

    enum CodingKeys: String, CodingKey {
        case name, gender, age, goal
        case heightCm      = "height_cm"
        case weightKg      = "weight_kg"
        case activityLevel = "activity_level"
    }
}
```

New:
```swift
struct UserProfile: Codable, Sendable {
    let name: String
    let gender: String
    let age: Int
    let heightCm: Int
    let weightKg: Double
    let activityLevel: Int    // API returns integer: 1=sedentary … 5=very active
    let goal: String

    enum CodingKeys: String, CodingKey {
        case name, gender, age, goal
        case heightCm      = "height_cm"
        case weightKg      = "weight_kg"
        case activityLevel = "activity_level"
    }
}
```

---

## Task 5: Fix AjustesViewModel.swift + AjustesView.swift

**Files:**
- Modify: `nutrition_frontend/ios-native/Metabolic/Features/Ajustes/AjustesViewModel.swift`
- Modify: `nutrition_frontend/ios-native/Metabolic/Features/Ajustes/AjustesView.swift`

### Root causes:
- `AjustesViewModel.activityLevel: String` → must be `Int` to match `UserProfile.activityLevel: Int`
- `ProfilePayload.activity_level: String` → API expects `Int`
- `AjustesView` Picker uses String tags (`"sedentary"`, `"moderate"`, etc.) → must use Int tags

Activity level mapping (standard Harris-Benedict):
| Int | Description |
|-----|-------------|
| 1   | Sedentario |
| 2   | Ligeramente activo |
| 3   | Moderadamente activo |
| 4   | Muy activo |
| 5   | Extremadamente activo |

- [x] **Step 1: Replace AjustesViewModel.swift**

```swift
import Foundation
import Observation
import SwiftUI

@MainActor
@Observable
final class AjustesViewModel {
    // Profile fields
    var name: String = ""
    var gender: String = "Hombre"
    var age: Int = 25
    var heightCm: Int = 175
    var weightKg: Double = 75.0
    var activityLevel: Int = 1    // 1=sedentary … 5=very active
    var goal: String = "lose"

    // Macros (display only — backend computes from profile)
    var caloriesPerDay: Int = 2000
    var proteinG: Int = 150
    var carbsG: Int = 200
    var fatG: Int = 65

    // Preferences
    var excluded: [String] = []
    var favorites: [String] = []
    var disliked: [String] = []

    // State
    var isSaving = false
    var isLoaded = false
    var loadError: String? = nil
    var saveError: String? = nil

    func load() async {
        do {
            async let profileResult: UserProfile = APIClient.shared.get(.profile)
            async let prefsResult: UserPreferences = APIClient.shared.get(.preferences)
            let (profile, prefs) = try await (profileResult, prefsResult)
            name = profile.name
            gender = profile.gender
            age = profile.age
            heightCm = profile.heightCm
            weightKg = profile.weightKg
            activityLevel = profile.activityLevel
            goal = profile.goal
            excluded = prefs.excluded
            favorites = prefs.favorites
            disliked = prefs.disliked
            isLoaded = true
        } catch {
            loadError = error.localizedDescription
        }
    }

    func save() async {
        isSaving = true
        defer { isSaving = false }
        do {
            let profilePayload = ProfilePayload(
                name: name, gender: gender, age: age,
                height_cm: heightCm, weight_kg: weightKg,
                activity_level: activityLevel, goal: goal
            )
            let prefsPayload = PrefsPayload(
                excluded: excluded, favorites: favorites, disliked: disliked
            )
            async let profileSave: UserProfile = APIClient.shared.put(.profile, body: profilePayload)
            async let prefsSave: UserPreferences = APIClient.shared.put(.preferences, body: prefsPayload)
            _ = try await (profileSave, prefsSave)
        } catch {
            saveError = error.localizedDescription
        }
    }

    func addToList(_ list: ReferenceWritableKeyPath<AjustesViewModel, [String]>, value: String) {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !self[keyPath: list].contains(trimmed) else { return }
        self[keyPath: list].append(trimmed)
    }

    func removeFromList(_ list: ReferenceWritableKeyPath<AjustesViewModel, [String]>, value: String) {
        self[keyPath: list].removeAll { $0 == value }
    }
}

private struct ProfilePayload: Encodable {
    let name: String
    let gender: String
    let age: Int
    let height_cm: Int
    let weight_kg: Double
    let activity_level: Int    // Int — matches API schema
    let goal: String
}

private struct PrefsPayload: Encodable {
    let excluded: [String]
    let favorites: [String]
    let disliked: [String]
}
```

- [x] **Step 2: Update Picker in AjustesView.swift — lines 57–63**

Old:
```swift
Picker("Actividad", selection: $viewModel.activityLevel) {
    Text("Sedentario").tag("sedentary")
    Text("Ligeramente activo").tag("light")
    Text("Moderadamente activo").tag("moderate")
    Text("Muy activo").tag("active")
    Text("Extremadamente activo").tag("very_active")
}
```

New:
```swift
Picker("Actividad", selection: $viewModel.activityLevel) {
    Text("Sedentario").tag(1)
    Text("Ligeramente activo").tag(2)
    Text("Moderadamente activo").tag(3)
    Text("Muy activo").tag(4)
    Text("Extremadamente activo").tag(5)
}
```

- [x] **Step 3: Build — full project should compile clean**

Run: `xcodebuild -scheme Metabolic -sdk iphonesimulator build 2>&1 | grep "error:" | head -20`

Expected: 0 errors.

- [ ] **Step 4: Commit** (pending user request)

```bash
cd /Users/practica/Desktop/Metabolic
git add nutrition_frontend/ios-native/Metabolic/Core/Models/NutritionModels.swift \
        nutrition_frontend/ios-native/Metabolic/Core/Models/UserProfile.swift \
        nutrition_frontend/ios-native/Metabolic/Features/Panel/PanelView.swift \
        nutrition_frontend/ios-native/Metabolic/Features/Panel/PanelViewModel.swift \
        nutrition_frontend/ios-native/Metabolic/Features/Ajustes/AjustesViewModel.swift \
        nutrition_frontend/ios-native/Metabolic/Features/Ajustes/AjustesView.swift
git commit -m "fix: adapt iOS models to real backend API response structure

- DashboardResponse: fix nutritionData CodingKey ('nutrition_data'→'nutrition'), remove weightData
- NutritionData: restructure for nested macros object, add MacroData struct
- ExerciseData: make steps/activeMinutes Optional (not returned by API)
- GoalBalance: replace all fields with actual API fields (consumed_kcal, active_kcal, net_balance, target_net)
- UserProfile.activityLevel: String→Int (API returns integer)
- PanelViewModel: fix restantes/diferencia to use GoalBalance fields
- PanelView: fix 7 computed vars referencing old field names
- AjustesViewModel/ProfilePayload: activity_level String→Int
- AjustesView: Picker tags String→Int

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
