import Foundation

struct WeightEntry: Codable, Identifiable, Sendable {
    let date: String
    let weightKg: Double
    let changeFromLast: Double?
    let trend7d: Double?

    var id: String { date }

    enum CodingKeys: String, CodingKey {
        case date
        case weightKg = "weight_kg"
        case changeFromLast = "change_from_last"
        case trend7d = "trend_7d"
    }
}

struct WeightHistoryResponse: Codable, Sendable {
    let entries: [WeightEntry]
    let weeklyChange: Double?
    let expectedChange: Double?

    enum CodingKeys: String, CodingKey {
        case entries
        case weeklyChange = "weekly_change"
        case expectedChange = "expected_change"
    }
}
