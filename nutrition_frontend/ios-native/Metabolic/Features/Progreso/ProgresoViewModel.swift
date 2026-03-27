import Foundation
import Observation

@MainActor
@Observable
final class ProgresoViewModel {
    var state: ViewState<WeightHistoryResponse> = .idle
    var showLogSheet = false
    var logWeight: Double = 80.0
    var logDate: Date = Date()
    var isLogging = false
    var logError: String? = nil

    var currentEntry: WeightEntry? {
        guard case .loaded(let data) = state else { return nil }
        return data.entries.first
    }

    var chartEntries: [WeightEntry] {
        guard case .loaded(let data) = state else { return [] }
        return data.entries.reversed()
    }

    func load() async {
        state = .loading
        do {
            let response: WeightHistoryResponse = try await APIClient.shared.get(.weightHistory)
            state = .loaded(response)
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    func logWeightEntry() async {
        isLogging = true
        defer { isLogging = false }
        do {
            struct WeightPayload: Encodable {
                let weight_kg: Double
                let date: String
            }
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            let payload = WeightPayload(weight_kg: logWeight, date: formatter.string(from: logDate))
            let _: WeightEntry = try await APIClient.shared.post(.logWeight, body: payload)
            showLogSheet = false
            await load()
        } catch {
            logError = error.localizedDescription
        }
    }
}
