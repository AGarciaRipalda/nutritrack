import XCTest
import SwiftUI
@testable import Metabolic

final class DesignSystemTests: XCTestCase {
    func testBrandColorIsNotNil() {
        // Color is a value type; just verify construction doesn't crash
        let color = Color.brand
        XCTAssertNotNil(color)
    }

    func testBrandGlassOpacity() {
        // Smoke test — Color.brandGlass must be constructable
        let glass = Color.brandGlass
        XCTAssertNotNil(glass)
    }

    func testMetricColorsNotNil() {
        XCTAssertNotNil(Color.metricKcal)
        XCTAssertNotNil(Color.metricSteps)
        XCTAssertNotNil(Color.metricTime)
        XCTAssertNotNil(Color.metricBpm)
    }

    func testDesignSystemSpacing() {
        XCTAssertEqual(DS.Spacing.md, 16)
        XCTAssertEqual(DS.Spacing.lg, 24)
        XCTAssertEqual(DS.PillButton.height, 36)
        XCTAssertEqual(DS.Radius.card, 16)
    }
}
