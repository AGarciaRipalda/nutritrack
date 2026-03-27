import Foundation

// Not @MainActor — network I/O runs off main thread; ViewModels use @MainActor instead
final class APIClient: Sendable {
    static let shared = APIClient()
    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: config)
    }

    func get<T: Decodable & Sendable>(_ endpoint: Endpoint, timezone: String = TimeZone.current.identifier) async throws -> T {
        var request = URLRequest(url: endpoint.url)
        request.setValue(timezone, forHTTPHeaderField: "x_user_timezone")
        return try await execute(request)
    }

    func post<T: Decodable & Sendable>(_ endpoint: Endpoint, body: (any Encodable)? = nil) async throws -> T {
        var request = URLRequest(url: endpoint.url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
        }
        return try await execute(request)
    }

    func put<T: Decodable & Sendable>(_ endpoint: Endpoint, body: any Encodable) async throws -> T {
        var request = URLRequest(url: endpoint.url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await execute(request)
    }

    private func execute<T: Decodable & Sendable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode) else {
            throw APIError.badResponse
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

enum APIError: LocalizedError, Sendable {
    case badResponse

    var errorDescription: String? {
        switch self {
        case .badResponse: return "Error de conexión con el servidor"
        }
    }
}
