import XCTest
@testable import Metabolic

final class ModelDecodingTests: XCTestCase {

    func testUserProfileDecodes() throws {
        let json = """
        {
            "name": "Alejandro",
            "gender": "Hombre",
            "age": 28,
            "height_cm": 178,
            "weight_kg": 80.0,
            "activity_level": 3,
            "goal": "lose"
        }
        """.data(using: .utf8)!
        let profile = try JSONDecoder().decode(UserProfile.self, from: json)
        XCTAssertEqual(profile.name, "Alejandro")
        XCTAssertEqual(profile.heightCm, 178)
        XCTAssertEqual(profile.goal, "lose")
    }

    func testUserPreferencesDecodes() throws {
        let json = """
        {
            "excluded": ["mariscos", "cacahuetes"],
            "favorites": ["pollo", "salmon"],
            "disliked": ["champinones"]
        }
        """.data(using: .utf8)!
        let prefs = try JSONDecoder().decode(UserPreferences.self, from: json)
        XCTAssertEqual(prefs.excluded.count, 2)
        XCTAssertTrue(prefs.favorites.contains("pollo"))
    }

    func testMealDecodes() throws {
        let json = """
        {
            "id": "meal_001",
            "name": "Arroz con pollo",
            "meal_type": "almuerzo",
            "kcal": 520,
            "protein_g": 35.0,
            "carbs_g": 55.0,
            "fat_g": 12.0
        }
        """.data(using: .utf8)!
        let meal = try JSONDecoder().decode(Meal.self, from: json)
        XCTAssertEqual(meal.kcal, 520)
        XCTAssertEqual(meal.mealType, "almuerzo")
    }

    func testWeightEntryDecodes() throws {
        let json = """
        {
            "date": "2026-03-26",
            "weight_kg": 80.0,
            "change_from_last": -0.2,
            "trend_7d": -1.0
        }
        """.data(using: .utf8)!
        let entry = try JSONDecoder().decode(WeightEntry.self, from: json)
        XCTAssertEqual(entry.weightKg, 80.0)
        XCTAssertEqual(entry.id, "2026-03-26")
    }

    func testWorkoutDecodes() throws {
        let json = """
        {
            "id": "wk_001",
            "name": "Tren superior",
            "status": "completed",
            "started_at": "2026-03-26T10:00:00",
            "finished_at": "2026-03-26T11:05:00",
            "duration_seconds": 3900,
            "total_volume_kg": 4500.0,
            "total_sets": 20,
            "training_block": "hypertrophy"
        }
        """.data(using: .utf8)!
        let workout = try JSONDecoder().decode(Workout.self, from: json)
        XCTAssertEqual(workout.name, "Tren superior")
        XCTAssertEqual(workout.durationFormatted, "65 min")
        XCTAssertEqual(workout.trainingBlock, "hypertrophy")
    }

    func testGoalBalanceDecodes() throws {
        let json = """
        {
            "consumed_kcal": 1500,
            "active_kcal": 300,
            "net_balance": -200,
            "target_net": 2100
        }
        """.data(using: .utf8)!
        let balance = try JSONDecoder().decode(GoalBalance.self, from: json)
        XCTAssertEqual(balance.consumedKcal, 1500)
        XCTAssertEqual(balance.activeKcal, 300)
    }
}
