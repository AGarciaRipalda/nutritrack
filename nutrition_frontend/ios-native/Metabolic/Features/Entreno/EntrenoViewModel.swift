import Foundation
import Observation

@MainActor
@Observable
final class EntrenoViewModel {
    var workoutsState: ViewState<[Workout]> = .idle

    // Cached ISO8601 formatters — DateFormatter allocation is expensive
    private static let iso8601WithFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let iso8601Standard: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    var todayCount: Int {
        guard case .loaded(let workouts) = workoutsState else { return 0 }
        let todayStart = Calendar.current.startOfDay(for: Date())
        return workouts.filter { workout in
            guard let dateStr = workout.finishedAt else { return false }
            if let date = EntrenoViewModel.iso8601WithFractional.date(from: dateStr) {
                return Calendar.current.startOfDay(for: date) == todayStart
            }
            if let date = EntrenoViewModel.iso8601Standard.date(from: dateStr) {
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
