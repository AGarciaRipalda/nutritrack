import Foundation

struct DashboardResponse: Codable, Sendable {
    let nutritionData: NutritionData?
    let exerciseData: ExerciseData?
    let weightData: WeightData?
    let goalBalance: GoalBalance?

    enum CodingKeys: String, CodingKey {
        case nutritionData = "nutrition_data"
        case exerciseData = "exercise_data"
        case weightData = "weight_data"
        case goalBalance = "goal_balance"
    }
}

struct NutritionData: Codable, Sendable {
    let targetKcal: Int
    let consumedKcal: Int
    let proteinG: Double
    let carbsG: Double
    let fatG: Double

    enum CodingKeys: String, CodingKey {
        case targetKcal = "target_kcal"
        case consumedKcal = "consumed_kcal"
        case proteinG = "protein_g"
        case carbsG = "carbs_g"
        case fatG = "fat_g"
    }
}

struct ExerciseData: Codable, Sendable {
    let burnedKcal: Int
    let steps: Int
    let activeMinutes: Int
    let bpm: Int?

    enum CodingKeys: String, CodingKey {
        case burnedKcal = "burned_kcal"
        case steps
        case activeMinutes = "active_minutes"
        case bpm
    }
}

struct WeightData: Codable, Sendable {
    let currentKg: Double
    let changeKg: Double?

    enum CodingKeys: String, CodingKey {
        case currentKg = "current_kg"
        case changeKg = "change_kg"
    }
}

struct GoalBalance: Codable, Sendable {
    let intake: Int
    let target: Int
    let activeExpenditure: Int
    let difference: Int

    enum CodingKeys: String, CodingKey {
        case intake, target, difference
        case activeExpenditure = "active_expenditure"
    }
}

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
        case carbsG = "carbs_g"
        case fatG = "fat_g"
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
