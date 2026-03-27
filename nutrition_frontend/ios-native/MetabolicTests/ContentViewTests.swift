import XCTest
import SwiftUI
@testable import Metabolic

final class ContentViewTests: XCTestCase {
    func testContentViewInstantiates() {
        let view = ContentView()
        _ = view.body
    }
}
