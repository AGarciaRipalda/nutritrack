import Foundation
import Observation

@MainActor
@Observable
final class DietaViewModel {
    var selectedPlan: PlanMode = .daily
    var dailyState: ViewState<DietTodayResponse> = .idle
    var weeklyState: ViewState<DietWeeklyResponse> = .idle
    var isRegenerating = false

    enum PlanMode: Equatable { case daily, weekly }

    // Stored target from the last loaded daily plan (sum of planned meal kcals)
    var plannedKcal: Int = 0

    var totalConsumedKcal: Int {
        guard case .loaded(let data) = dailyState else { return 0 }
        return data.meals.reduce(0) { $0 + $1.kcal }
    }

    func load() async {
        await loadDaily()
    }

    func loadDaily() async {
        dailyState = .loading
        do {
            let response: DietTodayResponse = try await APIClient.shared.get(.dietToday)
            plannedKcal = response.meals.reduce(0) { $0 + $1.kcal }
            dailyState = .loaded(response)
        } catch {
            dailyState = .error(error.localizedDescription)
        }
    }

    func loadWeekly() async {
        weeklyState = .loading
        do {
            let response: DietWeeklyResponse = try await APIClient.shared.get(.dietWeekly)
            weeklyState = .loaded(response)
        } catch {
            weeklyState = .error(error.localizedDescription)
        }
    }

    func regenerate() async {
        isRegenerating = true
        defer { isRegenerating = false }
        do {
            let response: DietTodayResponse = try await APIClient.shared.post(.dietRegenerateToday)
            dailyState = .loaded(response)
        } catch {
            dailyState = .error(error.localizedDescription)
        }
    }
}
