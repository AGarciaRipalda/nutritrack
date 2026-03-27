import Foundation
import Observation

@MainActor
@Observable
final class PanelViewModel {
    var state: ViewState<DashboardResponse> = .idle

    var restantes: Int {
        guard case .loaded(let data) = state,
              let nutrition = data.nutritionData else { return 0 }
        return nutrition.targetKcal - nutrition.consumedKcal
    }

    var diferencia: Int {
        guard case .loaded(let data) = state,
              let balance = data.goalBalance else { return 0 }
        return balance.intake - balance.target + balance.activeExpenditure
    }

    var todayDateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, d MMM"
        formatter.locale = Locale(identifier: "es_ES")
        return formatter.string(from: Date()).capitalized
    }

    func load() async {
        state = .loading
        do {
            let response: DashboardResponse = try await APIClient.shared.get(.dashboard)
            state = .loaded(response)
        } catch {
            state = .error(error.localizedDescription)
        }
    }
}
