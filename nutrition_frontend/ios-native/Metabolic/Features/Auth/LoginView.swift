import SwiftUI

struct LoginView: View {
    let onSignIn: (String, String) async -> String?
    let onSignUp: () -> Void
    let onBack: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private var isValid: Bool {
        !email.isEmpty && !password.isEmpty
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color(.systemGroupedBackground).ignoresSafeArea()

            Button(action: onBack) {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Color(.label))
                    .padding(12)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
            }
            .padding(.leading, DS.Spacing.md)
            .padding(.top, 8)
            .zIndex(1)

            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: 80)
                    cardContent
                    Spacer().frame(height: 40)
                }
                .padding(.horizontal, DS.Spacing.lg)
            }
        }
    }

    private var cardContent: some View {
        VStack(spacing: 24) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color(hex: "#334155"), Color(hex: "#0f172a")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 64, height: 64)
                    .shadow(color: .black.opacity(0.15), radius: 8, y: 4)

                Image(systemName: "flame.fill")
                    .font(.title2)
                    .foregroundStyle(.white)
            }

            VStack(spacing: 4) {
                Text("Bienvenido a METABOLIC")
                    .font(.title3.weight(.bold))
                Text("Inicia sesión para continuar")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Correo electrónico")
                        .font(.subheadline.weight(.medium))
                    TextField("correo@ejemplo.com", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(12)
                        .background(Color(.systemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color(.separator), lineWidth: 1)
                        )
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Contraseña")
                        .font(.subheadline.weight(.medium))
                    HStack {
                        if showPassword {
                            TextField("••••••••", text: $password)
                                .textContentType(.password)
                        } else {
                            SecureField("••••••••", text: $password)
                                .textContentType(.password)
                        }

                        Button {
                            showPassword.toggle()
                        } label: {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(12)
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color(.separator), lineWidth: 1)
                    )
                }

                Button {
                    guard isValid else { return }
                    isSubmitting = true
                    errorMessage = nil

                    Task {
                        let error = await onSignIn(email, password)
                        await MainActor.run {
                            errorMessage = error
                            isSubmitting = false
                        }
                    }
                } label: {
                    Group {
                        if isSubmitting {
                            ProgressView()
                                .tint(Color(.systemBackground))
                        } else {
                            Text("Iniciar sesión")
                                .font(.body.weight(.semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(isValid ? Color(.label) : Color(.label).opacity(0.4))
                    .foregroundStyle(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(!isValid || isSubmitting)

                if let errorMessage, !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }

            HStack(spacing: 12) {
                Rectangle().fill(Color(.separator)).frame(height: 1)
                Text("o")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Rectangle().fill(Color(.separator)).frame(height: 1)
            }

            Button {
                // Future: Google Sign-In
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "globe")
                        .font(.body)
                    Text("Iniciar sesión con Google")
                        .font(.subheadline.weight(.medium))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color(.systemBackground))
                .foregroundStyle(Color(.label))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color(.separator), lineWidth: 1)
                )
            }

            HStack {
                Button("¿Olvidaste tu contraseña?") {}
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("¿No tienes cuenta? Regístrate") {
                    onSignUp()
                }
                .font(.caption.weight(.medium))
                .foregroundStyle(Color.brand)
            }
        }
        .padding(24)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(color: .black.opacity(0.08), radius: 24, y: 8)
    }
}
