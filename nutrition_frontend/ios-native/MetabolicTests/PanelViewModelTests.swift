import XCTest
@testable import Metabolic

@MainActor
final class PanelViewModelTests: XCTestCase {

    func testRestantesWhenLoaded() {
        let vm = PanelViewModel()
        let nutrition = NutritionData(targetKcal: 2100, consumedKcal: 500, proteinG: 50, carbsG: 100, fatG: 20)
        let response = DashboardResponse(nutritionData: nutrition, exerciseData: nil, weightData: nil, goalBalance: nil)
        vm.state = .loaded(response)
        XCTAssertEqual(vm.restantes, 1600)
    }

    func testRestantesWhenIdle() {
        let vm = PanelViewModel()
        XCTAssertEqual(vm.restantes, 0)
    }

    func testRestantesIsNegativeWhenConsumedExceedsTarget() {
        let vm = PanelViewModel()
        let nutrition = NutritionData(targetKcal: 2000, consumedKcal: 2200, proteinG: 0, carbsG: 0, fatG: 0)
        let response = DashboardResponse(nutritionData: nutrition, exerciseData: nil, weightData: nil, goalBalance: nil)
        vm.state = .loaded(response)
        // restantes can go negative when consumed > target
        XCTAssertEqual(vm.restantes, -200)
    }

    func testDiferenciaComputation() {
        let vm = PanelViewModel()
        let balance = GoalBalance(intake: 1200, target: 2000, activeExpenditure: 350, difference: 0)
        let response = DashboardResponse(nutritionData: nil, exerciseData: nil, weightData: nil, goalBalance: balance)
        vm.state = .loaded(response)
        // diferencia = intake - target + activeExpenditure = 1200 - 2000 + 350 = -450
        XCTAssertEqual(vm.diferencia, -450)
    }

    func testTodayDateStringIsNotEmpty() {
        let vm = PanelViewModel()
        XCTAssertFalse(vm.todayDateString.isEmpty)
    }
}
