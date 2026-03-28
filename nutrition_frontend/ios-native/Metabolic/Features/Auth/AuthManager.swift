import SwiftUI

@MainActor
@Observable
final class AuthManager {
    enum Screen: Equatable {
        case landing
        case login
        case home
    }

    private(set) var currentScreen: Screen = .landing
    private(set) var lastError: String?

    func restoreSession() async {
        guard AuthTokenStore.shared.readToken() != nil else {
            currentScreen = .landing
            return
        }

        do {
            let _: AuthenticatedUser = try await APIClient.shared.get(.authMe)
            lastError = nil
            currentScreen = .home
        } catch {
            AuthTokenStore.shared.clearToken()
            currentScreen = .landing
        }
    }

    func signIn(email: String, password: String) async -> String? {
        do {
            let response: AuthResponse = try await APIClient.shared.post(
                .authLogin,
                body: LoginRequest(email: email, password: password),
                requiresAuth: false
            )

            guard AuthTokenStore.shared.saveToken(response.accessToken) else {
                let message = "No se pudo guardar la sesión."
                lastError = message
                return message
            }

            lastError = nil
            currentScreen = .home
            return nil
        } catch {
            let message =
                (error as? LocalizedError)?.errorDescription
                ?? "No se pudo iniciar sesión."
            lastError = message
            return message
        }
    }

    func signOut() {
        AuthTokenStore.shared.clearToken()
        lastError = nil
        currentScreen = .landing
    }

    func showLogin() {
        lastError = nil
        currentScreen = .login
    }

    func showLanding() {
        lastError = nil
        currentScreen = .landing
    }
}
