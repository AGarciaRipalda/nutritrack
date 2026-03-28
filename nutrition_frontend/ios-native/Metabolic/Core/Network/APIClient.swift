import Foundation
import Security

final class APIClient: Sendable {
    static let shared = APIClient()
    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: config)
    }

    func get<T: Decodable & Sendable>(
        _ endpoint: Endpoint,
        timezone: String = TimeZone.current.identifier,
        requiresAuth: Bool = true
    ) async throws -> T {
        var request = URLRequest(url: endpoint.url)
        request.setValue(timezone, forHTTPHeaderField: "x_user_timezone")
        try authorize(&request, requiresAuth: requiresAuth)
        return try await execute(request)
    }

    func post<T: Decodable & Sendable>(
        _ endpoint: Endpoint,
        body: (any Encodable)? = nil,
        requiresAuth: Bool = true
    ) async throws -> T {
        var request = URLRequest(url: endpoint.url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try authorize(&request, requiresAuth: requiresAuth)
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
        }
        return try await execute(request)
    }

    func put<T: Decodable & Sendable>(
        _ endpoint: Endpoint,
        body: any Encodable,
        requiresAuth: Bool = true
    ) async throws -> T {
        var request = URLRequest(url: endpoint.url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try authorize(&request, requiresAuth: requiresAuth)
        request.httpBody = try JSONEncoder().encode(body)
        return try await execute(request)
    }

    private func authorize(_ request: inout URLRequest, requiresAuth: Bool) throws {
        guard requiresAuth else { return }
        guard let token = AuthTokenStore.shared.readToken() else {
            throw APIError.missingAuthToken
        }
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }

    private func execute<T: Decodable & Sendable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.badResponse(statusCode: 0)
        }

        guard (200..<300).contains(http.statusCode) else {
            let detail = decodeErrorDetail(from: data)

            if http.statusCode == 401, request.value(forHTTPHeaderField: "Authorization") != nil {
                AuthTokenStore.shared.clearToken()
            }

            if let detail, !detail.isEmpty {
                throw APIError.serverMessage(detail)
            }

            if http.statusCode == 401 {
                throw APIError.unauthorized
            }

            throw APIError.badResponse(statusCode: http.statusCode)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    private func decodeErrorDetail(from data: Data) -> String? {
        guard
            let payload = try? JSONDecoder().decode(APIErrorPayload.self, from: data)
        else {
            return nil
        }

        if let detail = payload.detailString, !detail.isEmpty {
            return detail
        }

        if let first = payload.detailItems?.first?.message, !first.isEmpty {
            return first
        }

        return nil
    }
}

enum APIError: LocalizedError, Sendable {
    case missingAuthToken
    case unauthorized
    case badResponse(statusCode: Int)
    case serverMessage(String)

    var errorDescription: String? {
        switch self {
        case .missingAuthToken:
            return "No hay una sesión activa."
        case .unauthorized:
            return "La sesión ha expirado. Vuelve a iniciar sesión."
        case .badResponse(let code):
            return "Error del servidor (código \(code))."
        case .serverMessage(let message):
            return message
        }
    }
}

private struct APIErrorPayload: Decodable, Sendable {
    let detailString: String?
    let detailItems: [APIErrorItem]?

    enum CodingKeys: String, CodingKey {
        case detail
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        if let detail = try? container.decode(String.self, forKey: .detail) {
            self.detailString = detail
            self.detailItems = nil
            return
        }

        if let detail = try? container.decode([APIErrorItem].self, forKey: .detail) {
            self.detailString = nil
            self.detailItems = detail
            return
        }

        self.detailString = nil
        self.detailItems = nil
    }
}

private struct APIErrorItem: Decodable, Sendable {
    let message: String

    enum CodingKeys: String, CodingKey {
        case message = "msg"
    }
}

struct LoginRequest: Encodable, Sendable {
    let email: String
    let password: String
}

struct AuthenticatedUser: Codable, Sendable {
    let id: String
    let email: String
    let name: String?
}

struct AuthResponse: Codable, Sendable {
    let accessToken: String
    let tokenType: String
    let user: AuthenticatedUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case tokenType = "token_type"
        case user
    }
}

final class AuthTokenStore {
    static let shared = AuthTokenStore()

    private let service = "com.metabolic.app.auth"
    private let account = "access-token"

    private init() {}

    func saveToken(_ token: String) -> Bool {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)

        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
        ]

        return SecItemAdd(addQuery as CFDictionary, nil) == errSecSuccess
    }

    func readToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess,
              let data = item as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }

        return token
    }

    func clearToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
