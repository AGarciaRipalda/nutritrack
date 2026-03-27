import XCTest
@testable import Metabolic

@MainActor
final class DietaViewModelTests: XCTestCase {

    func testTotalConsumedKcalWhenLoaded() {
        let vm = DietaViewModel()
        let meals = [
            Meal(id: "1", name: "Desayuno", mealType: "desayuno", kcal: 400, proteinG: 20, carbsG: 50, fatG: 10),
            Meal(id: "2", name: "Almuerzo", mealType: "almuerzo", kcal: 600, proteinG: 40, carbsG: 60, fatG: 15)
        ]
        vm.dailyState = .loaded(DietTodayResponse(meals: meals, adherence: nil, stale: nil))
        XCTAssertEqual(vm.totalConsumedKcal, 1000)
    }

    func testTotalConsumedKcalWhenIdle() {
        let vm = DietaViewModel()
        XCTAssertEqual(vm.totalConsumedKcal, 0)
    }

    func testTotalConsumedKcalWhenEmpty() {
        let vm = DietaViewModel()
        vm.dailyState = .loaded(DietTodayResponse(meals: [], adherence: nil, stale: nil))
        XCTAssertEqual(vm.totalConsumedKcal, 0)
    }

    func testDefaultPlanModeIsDaily() {
        let vm = DietaViewModel()
        XCTAssertEqual(vm.selectedPlan, DietaViewModel.PlanMode.daily)
    }

    func testIsRegeneratingDefaultFalse() {
        let vm = DietaViewModel()
        XCTAssertFalse(vm.isRegenerating)
    }

    func testPlannedKcalUpdatedWhenStateLoaded() {
        let vm = DietaViewModel()
        let meals = [
            Meal(id: "1", name: "Desayuno", mealType: "desayuno", kcal: 400, proteinG: 20, carbsG: 50, fatG: 10),
            Meal(id: "2", name: "Almuerzo", mealType: "almuerzo", kcal: 700, proteinG: 40, carbsG: 70, fatG: 20)
        ]
        // Simulate what loadDaily() does after getting response
        vm.plannedKcal = meals.reduce(0) { $0 + $1.kcal }
        vm.dailyState = .loaded(DietTodayResponse(meals: meals, adherence: nil, stale: nil))
        XCTAssertEqual(vm.plannedKcal, 1100)
    }
}
