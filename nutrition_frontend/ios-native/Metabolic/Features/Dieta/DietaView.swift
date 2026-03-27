import SwiftUI

struct DietaView: View {
    @State private var viewModel = DietaViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Segmented picker
                Picker("Plan", selection: $viewModel.selectedPlan) {
                    Text("Plan diario").tag(DietaViewModel.PlanMode.daily)
                    Text("Plan semanal").tag(DietaViewModel.PlanMode.weekly)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, DS.Spacing.md)
                .padding(.top, DS.Spacing.sm)

                ScrollView {
                    Group {
                        if viewModel.selectedPlan == .daily {
                            dailyContent
                        } else {
                            weeklyContent
                        }
                    }
                    .padding(.horizontal, DS.Spacing.md)
                    .padding(.top, DS.Spacing.md)
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Dieta")
            .navigationSubtitle(consumedSubtitle)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    PillButton("Generar plan", icon: "wand.and.stars") {
                        Task { await viewModel.regenerate() }
                    }
                    .disabled(viewModel.isRegenerating)
                }
            }
            .task { await viewModel.load() }
            .onChange(of: viewModel.selectedPlan) { _, newValue in
                if newValue == .weekly {
                    Task { await viewModel.loadWeekly() }
                }
            }
        }
    }

    private var consumedSubtitle: String {
        "\(viewModel.plannedKcal) kcal planificadas hoy"
    }

    // MARK: — Daily Content
    @ViewBuilder
    private var dailyContent: some View {
        switch viewModel.dailyState {
        case .idle, .loading:
            ProgressView()
                .frame(maxWidth: .infinity, minHeight: 200)

        case .loaded(let data):
            if data.meals.isEmpty {
                emptyState
            } else {
                mealsList(meals: data.meals)
            }

        case .error(let message):
            ContentUnavailableView("Error", systemImage: "exclamationmark.triangle", description: Text(message))
        }
    }

    // MARK: — Weekly Content
    @ViewBuilder
    private var weeklyContent: some View {
        switch viewModel.weeklyState {
        case .idle, .loading:
            ProgressView()
                .frame(maxWidth: .infinity, minHeight: 200)

        case .loaded(let data):
            LazyVStack(spacing: DS.Spacing.md) {
                ForEach(data.days, id: \.date) { day in
                    weeklyDayCard(day: day)
                }
            }

        case .error(let message):
            ContentUnavailableView("Error", systemImage: "exclamationmark.triangle", description: Text(message))
        }
    }

    private func weeklyDayCard(day: DietWeeklyDay) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: DS.Spacing.sm) {
                Text(day.date)
                    .font(.subheadline.weight(.semibold))
                Text("\(day.kcalTarget) kcal objetivo")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                ForEach(day.meals) { meal in
                    mealRow(meal)
                }
            }
        }
    }

    // MARK: — Empty State
    private var emptyState: some View {
        GlassCard {
            VStack(spacing: DS.Spacing.md) {
                Image(systemName: "lightbulb")
                    .font(.system(size: 40))
                    .foregroundStyle(.secondary)
                Text("Sin comidas planificadas")
                    .font(.headline)
                Text("Pulsa \"Generar plan\" para crear tu menú de hoy con IA")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, DS.Spacing.lg)
        }
    }

    // MARK: — Meals List
    private func mealsList(meals: [Meal]) -> some View {
        let grouped = Dictionary(grouping: meals, by: \.mealType)
        let order = ["desayuno", "almuerzo", "cena", "snacks"]

        return LazyVStack(spacing: DS.Spacing.md) {
            ForEach(order.filter { grouped[$0] != nil }, id: \.self) { mealType in
                mealTypeSection(mealType: mealType, meals: grouped[mealType]!)
            }
        }
    }

    private func mealTypeSection(mealType: String, meals: [Meal]) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: DS.Spacing.sm) {
                Text(mealType.capitalized)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.brand)
                ForEach(meals) { meal in
                    mealRow(meal)
                    if meal.id != meals.last?.id {
                        Divider()
                    }
                }
            }
        }
    }

    private func mealRow(_ meal: Meal) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(meal.name)
                    .font(.body)
                HStack(spacing: DS.Spacing.sm) {
                    Text("\(Int(meal.proteinG))g prot")
                    Text("\(Int(meal.carbsG))g carbs")
                    Text("\(Int(meal.fatG))g grasas")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(meal.kcal) kcal")
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(Color.brand)
        }
    }
}
