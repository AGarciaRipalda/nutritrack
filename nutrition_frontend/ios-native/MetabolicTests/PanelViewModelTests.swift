import XCTest
@testable import Metabolic

@MainActor
final class PanelViewModelTests: XCTestCase {

    func testRestantesWhenLoaded() {
        let vm = PanelViewModel()
        let balance = GoalBalance(consumedKcal: 500, activeKcal: 0, netBalance: 0, targetNet: 2100)
        let response = DashboardResponse(nutritionData: nil, exerciseData: nil, goalBalance: balance)
        vm.state = .loaded(response)
        XCTAssertEqual(vm.restantes, 1600)
    }

    func testRestantesWhenIdle() {
        let vm = PanelViewModel()
        XCTAssertEqual(vm.restantes, 0)
    }

    func testRestantesIsNegativeWhenConsumedExceedsTarget() {
        let vm = PanelViewModel()
        let balance = GoalBalance(consumedKcal: 2200, activeKcal: 0, netBalance: 0, targetNet: 2000)
        let response = DashboardResponse(nutritionData: nil, exerciseData: nil, goalBalance: balance)
        vm.state = .loaded(response)
        // restantes can go negative when consumed > target
        XCTAssertEqual(vm.restantes, -200)
    }

    func testDiferenciaComputation() {
        let vm = PanelViewModel()
        let balance = GoalBalance(consumedKcal: 1200, activeKcal: 350, netBalance: -450, targetNet: 2000)
        let response = DashboardResponse(nutritionData: nil, exerciseData: nil, goalBalance: balance)
        vm.state = .loaded(response)
        // diferencia = netBalance (computed by backend)
        XCTAssertEqual(vm.diferencia, -450)
    }

    func testTodayDateStringContainsCommaAndMonth() {
        let vm = PanelViewModel()
        let dateString = vm.todayDateString
        // Spanish locale format: "Viernes, 27 Mar" — should contain a comma
        XCTAssertTrue(dateString.contains(","), "Expected Spanish date format with comma, got: \(dateString)")
        // Should not be empty
        XCTAssertFalse(dateString.isEmpty)
    }
}
