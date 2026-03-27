import Foundation

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
        case heightCm = "height_cm"
        case weightKg = "weight_kg"
        case activityLevel = "activity_level"
    }
}

struct UserPreferences: Codable, Sendable {
    let excluded: [String]
    let favorites: [String]
    let disliked: [String]
}
