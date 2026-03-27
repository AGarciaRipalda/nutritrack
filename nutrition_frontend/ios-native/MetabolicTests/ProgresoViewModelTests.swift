import XCTest
@testable import Metabolic

@MainActor
final class ProgresoViewModelTests: XCTestCase {

    func testCurrentEntryReturnsFirstEntry() {
        let vm = ProgresoViewModel()
        let entries = [
            WeightEntry(date: "2026-03-26", weightKg: 80.0, changeFromLast: -0.2, trend7d: nil),
            WeightEntry(date: "2026-03-25", weightKg: 80.2, changeFromLast: -0.3, trend7d: nil)
        ]
        vm.state = .loaded(WeightHistoryResponse(entries: entries, weeklyChange: nil, expectedChange: nil))
        XCTAssertEqual(vm.currentEntry?.weightKg, 80.0)
        XCTAssertEqual(vm.currentEntry?.date, "2026-03-26")
    }

    func testCurrentEntryNilWhenIdle() {
        let vm = ProgresoViewModel()
        XCTAssertNil(vm.currentEntry)
    }

    func testChartEntriesReversed() {
        let vm = ProgresoViewModel()
        let entries = [
            WeightEntry(date: "2026-03-26", weightKg: 80.0, changeFromLast: nil, trend7d: nil),
            WeightEntry(date: "2026-03-25", weightKg: 80.5, changeFromLast: nil, trend7d: nil),
            WeightEntry(date: "2026-03-24", weightKg: 81.0, changeFromLast: nil, trend7d: nil)
        ]
        vm.state = .loaded(WeightHistoryResponse(entries: entries, weeklyChange: nil, expectedChange: nil))
        let chart = vm.chartEntries
        // chartEntries is reversed: oldest first
        XCTAssertEqual(chart.first?.date, "2026-03-24")
        XCTAssertEqual(chart.last?.date, "2026-03-26")
    }

    func testLogErrorClearsOnSuccess() {
        let vm = ProgresoViewModel()
        vm.logError = "Some error"
        vm.logError = nil
        XCTAssertNil(vm.logError)
    }
}
