import SwiftUI

struct LandingView: View {
    let onLogin: () -> Void
    let onRegister: () -> Void

    private let features: [(emoji: String, title: String, description: String)] = [
        ("🥗", "Plan de dieta con IA", "Menús diarios y semanales personalizados generados con inteligencia artificial."),
        ("💪", "Seguimiento de entrenamientos", "Registra tus sesiones, ejercicios, series y progresión de carga."),
        ("📈", "Progreso real", "Visualiza tu evolución de peso con gráficas y tendencias semanales."),
        ("🎯", "Metas personalizadas", "Objetivos adaptativos según tu meta: perder, mantener o ganar masa."),
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                heroSection
                featuresSection
                ctaSection
                footerSection
            }
        }
        .background(Color(.systemGroupedBackground))
        .ignoresSafeArea(edges: .bottom)
    }

    private var heroSection: some View {
        VStack(spacing: 24) {
            Spacer().frame(height: 60)

            Image(systemName: "waveform.path.ecg")
                .font(.system(size: 64, weight: .medium))
                .foregroundStyle(Color.brand)
                .shadow(color: Color.brand.opacity(0.4), radius: 20, y: 4)

            Text("METABOLIC")
                .font(.system(size: 48, weight: .black))
                .tracking(-1)

            VStack(spacing: 12) {
                Button(action: onLogin) {
                    Text("Iniciar sesión")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color(.label))
                        .foregroundStyle(Color(.systemBackground))
                        .clipShape(Capsule())
                }

                Button(action: onRegister) {
                    Text("Registrarse")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .overlay(Capsule().stroke(Color(.label), lineWidth: 2))
                        .foregroundStyle(Color(.label))
                }
            }
            .padding(.horizontal, 40)

            Text("Tu mejor aliado para la nutrición, el entrenamiento y el seguimiento de tu progreso físico.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Spacer().frame(height: 40)
        }
        .frame(minHeight: UIScreen.main.bounds.height * 0.85)
    }

    private var featuresSection: some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12),
            ],
            spacing: 12
        ) {
            ForEach(features, id: \.title) { feature in
                VStack(alignment: .leading, spacing: 8) {
                    Text(feature.emoji)
                        .font(.title)
                    Text(feature.title)
                        .font(.subheadline.weight(.bold))
                    Text(feature.description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(4)
                }
                .padding(DS.Spacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.systemBackground))
                .clipShape(RoundedRectangle(cornerRadius: DS.Radius.card))
            }
        }
        .padding(.horizontal, DS.Spacing.md)
        .padding(.vertical, DS.Spacing.lg)
    }

    private var ctaSection: some View {
        VStack(spacing: 16) {
            Spacer().frame(height: 40)

            Text("Empieza hoy.")
                .font(.system(size: 36, weight: .black))

            Text("Tu cuerpo te lo agradecerá.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            VStack(spacing: 12) {
                Button(action: onLogin) {
                    Text("Iniciar sesión")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color(.label))
                        .foregroundStyle(Color(.systemBackground))
                        .clipShape(Capsule())
                }

                Button(action: onRegister) {
                    Text("Registrarse")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .overlay(Capsule().stroke(Color(.label), lineWidth: 2))
                        .foregroundStyle(Color(.label))
                }
            }
            .padding(.horizontal, 40)

            Spacer().frame(height: 60)
        }
    }

    private var footerSection: some View {
        VStack(spacing: 4) {
            Divider()
            HStack {
                Text("© 2026 METABOLIC.")
                Spacer()
                HStack(spacing: 4) {
                    Text("Hecho con")
                    Text("❤️")
                    Text("para tu salud")
                }
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
            .padding(.horizontal, DS.Spacing.md)
            .padding(.vertical, DS.Spacing.sm)
        }
        .background(Color(.systemBackground))
    }
}
