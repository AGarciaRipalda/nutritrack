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
