import XCTest
@testable import Metabolic

@MainActor
final class AjustesViewModelTests: XCTestCase {

    func testDefaultValues() {
        let vm = AjustesViewModel()
        XCTAssertEqual(vm.gender, "Hombre")
        XCTAssertEqual(vm.goal, "lose")
        XCTAssertEqual(vm.activityLevel, "moderate")
        XCTAssertFalse(vm.isSaving)
        XCTAssertFalse(vm.isLoaded)
    }

    func testAddToList() {
        let vm = AjustesViewModel()
        vm.addToList(\.excluded, value: "mariscos")
        XCTAssertTrue(vm.excluded.contains("mariscos"))
        XCTAssertEqual(vm.excluded.count, 1)
    }

    func testAddToListIgnoresDuplicates() {
        let vm = AjustesViewModel()
        vm.addToList(\.favorites, value: "pollo")
        vm.addToList(\.favorites, value: "pollo")
        XCTAssertEqual(vm.favorites.count, 1)
    }

    func testRemoveFromList() {
        let vm = AjustesViewModel()
        vm.addToList(\.disliked, value: "aceitunas")
        vm.removeFromList(\.disliked, value: "aceitunas")
        XCTAssertFalse(vm.disliked.contains("aceitunas"))
        XCTAssertTrue(vm.disliked.isEmpty)
    }

    func testAddToListIgnoresEmptyString() {
        let vm = AjustesViewModel()
        vm.addToList(\.excluded, value: "   ")
        XCTAssertTrue(vm.excluded.isEmpty)
    }

    func testLoadErrorStartsNil() {
        let vm = AjustesViewModel()
        XCTAssertNil(vm.loadError)
        XCTAssertNil(vm.saveError)
    }

    func testAddToListTrimsWhitespace() {
        let vm = AjustesViewModel()
        vm.addToList(\.favorites, value: "  salmón  ")
        XCTAssertTrue(vm.favorites.contains("salmón"))
        XCTAssertFalse(vm.favorites.contains("  salmón  "))
    }
}
