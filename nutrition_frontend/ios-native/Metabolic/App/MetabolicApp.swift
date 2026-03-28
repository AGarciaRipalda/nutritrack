import SwiftUI

@main
struct MetabolicApp: App {
    @State private var auth = AuthManager()
    @State private var showRegisterAlert = false

    var body: some Scene {
        WindowGroup {
            Group {
                switch auth.currentScreen {
                case .landing:
                    LandingView(
                        onLogin: { auth.showLogin() },
                        onRegister: { showRegisterAlert = true }
                    )

                case .login:
                    LoginView(
                        onSignIn: { email, password in
                            await auth.signIn(email: email, password: password)
                        },
                        onSignUp: { showRegisterAlert = true },
                        onBack: { auth.showLanding() }
                    )

                case .home:
                    ContentView()
                }
            }
            .animation(.easeInOut(duration: 0.3), value: auth.currentScreen)
            .task {
                await auth.restoreSession()
            }
            .alert("Registro", isPresented: $showRegisterAlert) {
                Button("Aceptar", role: .cancel) {}
            } message: {
                Text("Para registrarte, envía un correo a admin@metabolic.es solicitando tu cuenta.")
            }
        }
    }
}
