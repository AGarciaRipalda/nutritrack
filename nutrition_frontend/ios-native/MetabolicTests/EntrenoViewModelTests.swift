import XCTest
@testable import Metabolic

@MainActor
final class EntrenoViewModelTests: XCTestCase {

    func testTodayCountWhenIdle() {
        let vm = EntrenoViewModel()
        XCTAssertEqual(vm.todayCount, 0)
    }

    func testTodayCountWithNoTodayWorkouts() {
        let vm = EntrenoViewModel()
        let workout = Workout(
            id: "w1", name: "Legs", status: "completed",
            startedAt: "2026-03-01T10:00:00",
            finishedAt: "2026-03-01T11:00:00",
            durationSeconds: 3600, totalVolumeKg: 1000, totalSets: 15, trainingBlock: nil
        )
        vm.workoutsState = .loaded([workout])
        // Old date — should not count as today
        XCTAssertEqual(vm.todayCount, 0)
    }

    func testTodayCountWithTodayWorkout() {
        let vm = EntrenoViewModel()
        // Use today's date in ISO8601 format
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let todayStr = formatter.string(from: Date())
        let workout = Workout(
            id: "w2", name: "Push", status: "completed",
            startedAt: todayStr,
            finishedAt: todayStr,
            durationSeconds: 3300, totalVolumeKg: 2000, totalSets: 18, trainingBlock: nil
        )
        vm.workoutsState = .loaded([workout])
        XCTAssertEqual(vm.todayCount, 1)
    }

    func testTodayCountPluralWithTwoWorkouts() {
        let vm = EntrenoViewModel()
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let todayStr = formatter.string(from: Date())
        let w1 = Workout(id: "w1", name: "Push", status: "completed", startedAt: todayStr, finishedAt: todayStr, durationSeconds: 3600, totalVolumeKg: 1500, totalSets: 20, trainingBlock: nil)
        let w2 = Workout(id: "w2", name: "Pull", status: "completed", startedAt: todayStr, finishedAt: todayStr, durationSeconds: 3000, totalVolumeKg: 1200, totalSets: 18, trainingBlock: nil)
        vm.workoutsState = .loaded([w1, w2])
        XCTAssertEqual(vm.todayCount, 2)
    }
}
