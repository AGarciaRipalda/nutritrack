import XCTest
import SwiftUI
@testable import Metabolic

final class SharedComponentsTests: XCTestCase {

    func testGlassCardInstantiates() {
        // Verify GlassCard can be constructed without crashing
        let card = GlassCard { Text("Test") }
        _ = card.body
    }

    func testPillButtonInstantiates() {
        let button = PillButton("Test", icon: "star") { }
        _ = button.body
    }

    func testPillButtonWithoutIconInstantiates() {
        let button = PillButton("No Icon") { }
        _ = button.body
    }

    func testMetricBadgeInstantiates() {
        let badge = MetricBadge(icon: "flame", value: "500", label: "kcal", color: .metricKcal)
        _ = badge.body
    }

    func testFlowLayoutInstantiates() {
        let layout = FlowLayout(spacing: 8)
        XCTAssertEqual(layout.spacing, 8)

        let defaultLayout = FlowLayout()
        XCTAssertEqual(defaultLayout.spacing, 8)
    }
}
