import Foundation
import Security

actor APIClient {
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
        request.setValue(timezone, forHTTPHeaderField: "X-User-Timezone")
        try authorize(&request, requiresAuth: requiresAuth)
        return try await execute(request, allowRetry: requiresAuth)
    }

    func post<T: Decodable & Sendable>(
        _ endpoint: Endpoint,
        body: (any Encodable)? = nil,
        requiresAuth: Bool = true
    ) async throws -> T {
        var request = URLRequest(url: endpoint.url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(TimeZone.current.identifier, forHTTPHeaderField: "X-User-Timezone")
        try authorize(&request, requiresAuth: requiresAuth)
        if let body {
            request.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }
        return try await execute(request, allowRetry: requiresAuth)
    }

    func put<T: Decodable & Sendable>(
        _ endpoint: Endpoint,
        body: any Encodable,
        requiresAuth: Bool = true
    ) async throws -> T {
        var request = URLRequest(url: endpoint.url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(TimeZone.current.identifier, forHTTPHeaderField: "X-User-Timezone")
        try authorize(&request, requiresAuth: requiresAuth)
        request.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        return try await execute(request, allowRetry: requiresAuth)
    }

    func logoutCurrentSession() async {
        let accessToken = AuthTokenStore.shared.readAccessToken()
        let refreshToken = AuthTokenStore.shared.readRefreshToken()

        guard let refreshToken else {
            AuthTokenStore.shared.clearTokens()
            return
        }

        var request = URLRequest(url: Endpoint.authLogout.url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try? JSONEncoder().encode(
            LogoutRequest(refreshToken: refreshToken)
        )

        _ = try? await session.data(for: request)
        AuthTokenStore.shared.clearTokens()
    }

    private func authorize(_ request: inout URLRequest, requiresAuth: Bool) throws {
        guard requiresAuth else { return }
        guard let token = AuthTokenStore.shared.readAccessToken() else {
            throw APIError.missingAuthToken
        }
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }

    private func execute<T: Decodable & Sendable>(
        _ request: URLRequest,
        allowRetry: Bool
    ) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.badResponse(statusCode: 0)
        }

        if (200..<300).contains(http.statusCode) {
            if data.isEmpty, let empty = EmptyResponse() as? T {
                return empty
            }
            return try JSONDecoder().decode(T.self, from: data)
        }

        if http.statusCode == 401,
           request.value(forHTTPHeaderField: "Authorization") != nil,
           allowRetry,
           await refreshAccessToken()
        {
            var retriedRequest = request
            try authorize(&retriedRequest, requiresAuth: true)
            return try await execute(retriedRequest, allowRetry: false)
        }

        let detail = decodeErrorDetail(from: data)

        if http.statusCode == 401, request.value(forHTTPHeaderField: "Authorization") != nil {
            AuthTokenStore.shared.clearTokens()
        }

        if let detail, !detail.isEmpty {
            throw APIError.serverMessage(detail)
        }

        if http.statusCode == 401 {
            throw APIError.unauthorized
        }

        throw APIError.badResponse(statusCode: http.statusCode)
    }

    private func refreshAccessToken() async -> Bool {
        guard let refreshToken = AuthTokenStore.shared.readRefreshToken() else {
            AuthTokenStore.shared.clearTokens()
            return false
        }

        var request = URLRequest(url: Endpoint.authRefresh.url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(
            RefreshTokenRequest(refreshToken: refreshToken)
        )

        guard
            let (data, response) = try? await session.data(for: request),
            let http = response as? HTTPURLResponse,
            (200..<300).contains(http.statusCode),
            let authResponse = try? JSONDecoder().decode(AuthResponse.self, from: data)
        else {
            AuthTokenStore.shared.clearTokens()
            return false
        }

        guard AuthTokenStore.shared.saveSession(
            accessToken: authResponse.accessToken,
            refreshToken: authResponse.refreshToken
        ) else {
            AuthTokenStore.shared.clearTokens()
            return false
        }

        return true
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

private struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init(_ value: any Encodable) {
        self.encodeClosure = value.encode(to:)
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}

private struct EmptyResponse: Decodable, Sendable {}

struct LoginRequest: Encodable, Sendable {
    let email: String
    let password: String
}

struct RefreshTokenRequest: Encodable, Sendable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

struct LogoutRequest: Encodable, Sendable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

struct AuthenticatedUser: Codable, Sendable {
    let id: String
    let email: String
    let name: String?
    let role: String?
}

struct AuthResponse: Codable, Sendable {
    let accessToken: String
    let refreshToken: String
    let tokenType: String
    let accessExpiresAt: String?
    let refreshExpiresAt: String?
    let user: AuthenticatedUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case tokenType = "token_type"
        case accessExpiresAt = "access_expires_at"
        case refreshExpiresAt = "refresh_expires_at"
        case user
    }
}

final class AuthTokenStore {
    static let shared = AuthTokenStore()

    private let service = "com.metabolic.app.auth"
    private let accessAccount = "access-token"
    private let refreshAccount = "refresh-token"

    private init() {}

    func saveSession(accessToken: String, refreshToken: String) -> Bool {
        writeSecret(accessToken, account: accessAccount)
            && writeSecret(refreshToken, account: refreshAccount)
    }

    func readAccessToken() -> String? {
        readSecret(account: accessAccount)
    }

    func readRefreshToken() -> String? {
        readSecret(account: refreshAccount)
    }

    func readToken() -> String? {
        readAccessToken()
    }

    func clearTokens() {
        deleteSecret(account: accessAccount)
        deleteSecret(account: refreshAccount)
    }

    private func writeSecret(_ value: String, account: String) -> Bool {
        let data = Data(value.utf8)
        deleteSecret(account: account)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
        ]

        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    private func readSecret(account: String) -> String? {
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

    private func deleteSecret(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
