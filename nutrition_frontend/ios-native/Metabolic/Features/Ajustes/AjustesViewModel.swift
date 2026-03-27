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
    var activityLevel: String = "moderate"
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
            // Await both in parallel — if either throws, the other is cancelled
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
    let activity_level: String
    let goal: String
}

private struct PrefsPayload: Encodable {
    let excluded: [String]
    let favorites: [String]
    let disliked: [String]
}
