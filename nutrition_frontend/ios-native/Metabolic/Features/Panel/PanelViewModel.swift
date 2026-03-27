import Foundation
import Observation

@MainActor
@Observable
final class PanelViewModel {
    var state: ViewState<DashboardResponse> = .idle

    var restantes: Int {
        guard case .loaded(let data) = state,
              let balance = data.goalBalance else { return 0 }
        return balance.targetNet - balance.consumedKcal
    }

    var diferencia: Int {
        guard case .loaded(let data) = state,
              let balance = data.goalBalance else { return 0 }
        return balance.netBalance
    }

    private let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, d MMM"
        formatter.locale = Locale(identifier: "es_ES")
        return formatter
    }()

    var todayDateString: String {
        dateFormatter.string(from: Date()).capitalized
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
