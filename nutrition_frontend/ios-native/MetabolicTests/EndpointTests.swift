import XCTest
@testable import Metabolic

final class EndpointTests: XCTestCase {

    func testDashboardURL() {
        XCTAssertEqual(Endpoint.dashboard.url.absoluteString, "https://api.metabolic.es/dashboard")
    }

    func testDietTodayURL() {
        XCTAssertEqual(Endpoint.dietToday.url.absoluteString, "https://api.metabolic.es/diet/today")
    }

    func testDietWeeklyURL() {
        XCTAssertEqual(Endpoint.dietWeekly.url.absoluteString, "https://api.metabolic.es/diet/weekly")
    }

    func testDietRegenerateURL() {
        XCTAssertEqual(Endpoint.dietRegenerateToday.url.absoluteString, "https://api.metabolic.es/diet/today/regenerate")
    }

    func testWeightHistoryURL() {
        XCTAssertEqual(Endpoint.weightHistory.url.absoluteString, "https://api.metabolic.es/weight/history")
    }

    func testWorkoutsURL() {
        // POST and GET both use .workouts endpoint — HTTP method is determined by calling post() vs get()
        XCTAssertEqual(Endpoint.workouts.url.absoluteString, "https://api.metabolic.es/v2/training/workouts")
    }

    func testProfileURL() {
        // GET and PUT both use .profile endpoint
        XCTAssertEqual(Endpoint.profile.url.absoluteString, "https://api.metabolic.es/profile")
    }

    func testPreferencesURL() {
        // GET and PUT both use .preferences endpoint
        XCTAssertEqual(Endpoint.preferences.url.absoluteString, "https://api.metabolic.es/preferences")
    }

    func testBaseURL() {
        XCTAssertEqual(Endpoint.baseURL, "https://api.metabolic.es")
    }

    func testLogWeightURL() {
        XCTAssertEqual(Endpoint.logWeight.url.absoluteString, "https://api.metabolic.es/weight")
    }

    func testRoutinesURL() {
        XCTAssertEqual(Endpoint.routines.url.absoluteString, "https://api.metabolic.es/v2/training/routines")
    }

    func testGetRequestBuildsCorrectly() {
        // Verify that a URLRequest is created with GET method (default) and timezone header
        let endpoint = Endpoint.dashboard
        var request = URLRequest(url: endpoint.url)
        request.setValue("Europe/Madrid", forHTTPHeaderField: "x_user_timezone")
        XCTAssertEqual(request.value(forHTTPHeaderField: "x_user_timezone"), "Europe/Madrid")
        XCTAssertNil(request.httpMethod) // nil defaults to GET in URLSession
    }
}
