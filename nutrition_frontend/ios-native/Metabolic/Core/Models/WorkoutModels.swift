import Foundation

struct Workout: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let status: String
    let startedAt: String?
    let finishedAt: String?
    let durationSeconds: Int?
    let totalVolumeKg: Double?
    let totalSets: Int?
    let trainingBlock: String?

    enum CodingKeys: String, CodingKey {
        case id, name, status
        case startedAt = "started_at"
        case finishedAt = "finished_at"
        case durationSeconds = "duration_seconds"
        case totalVolumeKg = "total_volume_kg"
        case totalSets = "total_sets"
        case trainingBlock = "training_block"
    }

    var durationFormatted: String {
        guard let secs = durationSeconds else { return "-- min" }
        return "\(secs / 60) min"
    }

    // Returns "--" — real kcal data is not available from this endpoint
    var kcalDisplay: String { "-- kcal" }
}

struct Routine: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description
        case createdAt = "created_at"
    }
}
