import Foundation
import Observation

@MainActor
@Observable
final class EntrenoViewModel {
    var workoutsState: ViewState<[Workout]> = .idle

    var todayCount: Int {
        guard case .loaded(let workouts) = workoutsState else { return 0 }
        let todayStart = Calendar.current.startOfDay(for: Date())
        return workouts.filter { workout in
            guard let dateStr = workout.finishedAt else { return false }
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: dateStr) {
                return Calendar.current.startOfDay(for: date) == todayStart
            }
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: dateStr) {
                return Calendar.current.startOfDay(for: date) == todayStart
            }
            return false
        }.count
    }

    func load() async {
        workoutsState = .loading
        do {
            let workouts: [Workout] = try await APIClient.shared.get(.workouts)
            workoutsState = .loaded(workouts)
        } catch {
            workoutsState = .error(error.localizedDescription)
        }
    }

    func startNewWorkout() async throws {
        struct EmptyBody: Encodable {}
        let _: Workout = try await APIClient.shared.post(.workouts, body: EmptyBody())
        await load()
    }
}
