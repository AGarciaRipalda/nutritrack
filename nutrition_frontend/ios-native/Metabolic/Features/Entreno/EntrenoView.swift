import SwiftUI

struct EntrenoView: View {
    @State private var viewModel = EntrenoViewModel()
    @State private var showProximamenteAlert = false
    @State private var showNewWorkoutError = false
    @State private var newWorkoutError: String? = nil

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DS.Spacing.lg) {
                    // Action pills
                    HStack(spacing: DS.Spacing.sm) {
                        PillButton("IA", icon: "sparkles") {
                            showProximamenteAlert = true
                        }
                        PillButton("Importar", icon: "square.and.arrow.down") {
                            // v1: not implemented — show Próximamente alert
                            showProximamenteAlert = true
                        }
                        PillButton("Nuevo", icon: "plus") {
                            Task {
                                do {
                                    try await viewModel.startNewWorkout()
                                } catch {
                                    newWorkoutError = error.localizedDescription
                                    showNewWorkoutError = true
                                }
                            }
                        }
                        Spacer()
                    }
                    .padding(.horizontal, DS.Spacing.md)
                    .padding(.top, DS.Spacing.sm)

                    // Recent workouts
                    recentWorkoutsSection
                        .padding(.horizontal, DS.Spacing.md)
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Entreno")
            .navigationSubtitle(subtitleText)
            .task { await viewModel.load() }
            .alert("Próximamente", isPresented: $showProximamenteAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Esta función estará disponible próximamente.")
            }
            .alert("Error", isPresented: $showNewWorkoutError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(newWorkoutError ?? "")
            }
        }
    }

    private var subtitleText: String {
        let count = viewModel.todayCount
        return "\(count) \(count == 1 ? "sesión" : "sesiones") hoy"
    }

    // MARK: — Recent Workouts
    @ViewBuilder
    private var recentWorkoutsSection: some View {
        switch viewModel.workoutsState {
        case .idle, .loading:
            ProgressView()
                .frame(maxWidth: .infinity, minHeight: 100)

        case .loaded(let workouts):
            if workouts.isEmpty {
                ContentUnavailableView(
                    "Sin entrenamientos",
                    systemImage: "figure.run",
                    description: Text("Pulsa \"Nuevo\" para registrar tu primer entrenamiento")
                )
            } else {
                VStack(alignment: .leading, spacing: DS.Spacing.sm) {
                    Text("RECIENTES")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.leading, DS.Spacing.xs)

                    LazyVStack(spacing: DS.Spacing.sm) {
                        ForEach(workouts) { workout in
                            workoutRow(workout)
                        }
                    }
                }
            }

        case .error(let message):
            ContentUnavailableView("Error", systemImage: "exclamationmark.triangle", description: Text(message))
        }
    }

    private func workoutRow(_ workout: Workout) -> some View {
        GlassCard {
            HStack(spacing: DS.Spacing.md) {
                Image(systemName: "wand.and.sparkles")
                    .font(.title3)
                    .foregroundStyle(Color.brand)
                    .frame(width: 36, height: 36)
                    .background(Color.brandSubtle)
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 4) {
                    Text(workout.name)
                        .font(.body.weight(.medium))
                    HStack(spacing: DS.Spacing.sm) {
                        Label(workout.durationFormatted, systemImage: "timer")
                        Label(workout.kcalDisplay, systemImage: "flame")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                Spacer()

                HStack(spacing: DS.Spacing.sm) {
                    Button {
                        // Delete action — reload after delete (future: call DELETE endpoint)
                    } label: {
                        Image(systemName: "trash")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)

                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}
