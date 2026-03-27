import SwiftUI

struct PanelView: View {
    @State private var viewModel = PanelViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DS.Spacing.lg) {
                    caloriesCard
                    activityCard
                    balanceCard
                    motivationalBanner
                }
                .padding(.horizontal, DS.Spacing.md)
                .padding(.top, DS.Spacing.sm)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Panel")
            .navigationSubtitle(viewModel.todayDateString)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    goalChip
                }
            }
            .task { await viewModel.load() }
        }
    }

    // MARK: — Goal Chip
    private var goalChip: some View {
        HStack(spacing: 4) {
            Image(systemName: "arrow.down")
                .font(.caption.weight(.semibold))
            Text(goalLabel)
                .font(.caption.weight(.semibold))
        }
        .foregroundStyle(Color.brand)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Color.brandSubtle)
        .clipShape(Capsule())
    }

    private var goalLabel: String {
        if case .loaded(let data) = viewModel.state,
           let profile = data.nutritionData {
            // Use target kcal to infer goal — lower targets suggest weight loss
            if profile.targetKcal < 2000 { return "Perder peso" }
            if profile.targetKcal < 2500 { return "Mantener" }
            return "Ganar músculo"
        }
        return "Perder peso"
    }

    // MARK: — Calories Card
    private var caloriesCard: some View {
        GlassCard {
            HStack(alignment: .top, spacing: DS.Spacing.lg) {
                // Circular indicator
                ZStack {
                    Circle()
                        .stroke(Color.brand.opacity(0.15), lineWidth: 8)
                    Circle()
                        .trim(from: 0, to: calorieProgress)
                        .stroke(Color.brand, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 2) {
                        Text("\(restantesValue)")
                            .font(.title2.bold().monospacedDigit())
                        Text("RESTANTES")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(width: 110, height: 110)

                // Right side: consumed + macros
                VStack(alignment: .leading, spacing: DS.Spacing.sm) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(consumedLabel)
                            .font(.subheadline.monospacedDigit())
                        Text("kcal consumidas hoy")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    HStack(spacing: DS.Spacing.md) {
                        macroItem(label: "Proteína", value: proteinValue)
                        macroItem(label: "Carbos", value: carbsValue)
                        macroItem(label: "Grasas", value: fatValue)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func macroItem(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.subheadline.bold().monospacedDigit())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private var calorieProgress: Double {
        guard case .loaded(let data) = viewModel.state,
              let nutrition = data.nutritionData,
              nutrition.targetKcal > 0 else { return 0 }
        return min(Double(nutrition.consumedKcal) / Double(nutrition.targetKcal), 1.0)
    }

    private var restantesValue: String {
        guard case .loaded(let data) = viewModel.state,
              let nutrition = data.nutritionData else { return "0" }
        return "\(nutrition.targetKcal - nutrition.consumedKcal)"
    }

    private var consumedLabel: String {
        guard case .loaded(let data) = viewModel.state,
              let nutrition = data.nutritionData else { return "0 / 0" }
        return "\(nutrition.consumedKcal) / \(nutrition.targetKcal)"
    }

    private var proteinValue: String {
        guard case .loaded(let data) = viewModel.state,
              let nutrition = data.nutritionData else { return "0g" }
        return "\(Int(nutrition.proteinG))g"
    }

    private var carbsValue: String {
        guard case .loaded(let data) = viewModel.state,
              let nutrition = data.nutritionData else { return "0g" }
        return "\(Int(nutrition.carbsG))g"
    }

    private var fatValue: String {
        guard case .loaded(let data) = viewModel.state,
              let nutrition = data.nutritionData else { return "0g" }
        return "\(Int(nutrition.fatG))g"
    }

    // MARK: — Activity Card
    private var activityCard: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: DS.Spacing.md) {
                HStack {
                    Text("Actividad")
                        .font(.headline)
                    Spacer()
                    Text("Hoy")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 0) {
                    MetricBadge(
                        icon: "flame.fill",
                        value: burnedKcalValue,
                        label: "kcal",
                        color: .metricKcal
                    )
                    MetricBadge(
                        icon: "figure.walk",
                        value: stepsValue,
                        label: "pasos",
                        color: .metricSteps
                    )
                    MetricBadge(
                        icon: "timer",
                        value: activeMinValue,
                        label: "min",
                        color: .metricTime
                    )
                    MetricBadge(
                        icon: "heart.fill",
                        value: bpmValue,
                        label: "bpm",
                        color: .metricBpm
                    )
                }
            }
        }
    }

    private var burnedKcalValue: String {
        guard case .loaded(let data) = viewModel.state,
              let exercise = data.exerciseData else { return "0" }
        return "\(exercise.burnedKcal)"
    }

    private var stepsValue: String {
        guard case .loaded(let data) = viewModel.state,
              let exercise = data.exerciseData else { return "0" }
        return "\(exercise.steps)"
    }

    private var activeMinValue: String {
        guard case .loaded(let data) = viewModel.state,
              let exercise = data.exerciseData else { return "0" }
        return "\(exercise.activeMinutes)"
    }

    private var bpmValue: String {
        guard case .loaded(let data) = viewModel.state,
              let exercise = data.exerciseData,
              let bpm = exercise.bpm else { return "--" }
        return "\(bpm)"
    }

    // MARK: — Balance Card
    private var balanceCard: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: DS.Spacing.sm) {
                HStack {
                    Text("Balance")
                        .font(.headline)
                    Spacer()
                    Image(systemName: "info.circle")
                        .foregroundStyle(.secondary)
                }

                Divider()

                balanceRow(label: "Ingesta", value: ingestaValue, valueColor: .primary)
                balanceRow(label: "Meta", value: metaValue, valueColor: .primary)
                balanceRow(label: "Gasto activo", value: gastoValue, valueColor: .green)

                Divider()

                balanceRow(
                    label: "Diferencia",
                    value: diferenciaValue,
                    valueColor: viewModel.diferencia >= 0 ? Color.brand : Color.metricBpm
                )
            }
        }
    }

    private func balanceRow(label: String, value: String, valueColor: Color) -> some View {
        HStack {
            Text(label)
                .font(.body)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.body.monospacedDigit())
                .foregroundStyle(valueColor)
        }
    }

    private var ingestaValue: String {
        guard case .loaded(let data) = viewModel.state,
              let b = data.goalBalance else { return "0 kcal" }
        return "\(b.intake) kcal"
    }

    private var metaValue: String {
        guard case .loaded(let data) = viewModel.state,
              let b = data.goalBalance else { return "0 kcal" }
        return "\(b.target) kcal"
    }

    private var gastoValue: String {
        guard case .loaded(let data) = viewModel.state,
              let b = data.goalBalance else { return "+0 kcal" }
        return "+\(b.activeExpenditure) kcal"
    }

    private var diferenciaValue: String {
        let diff = viewModel.diferencia
        return diff >= 0 ? "+\(diff) kcal" : "\(diff) kcal"
    }

    // MARK: — Motivational Banner
    private var motivationalBanner: some View {
        HStack(spacing: DS.Spacing.md) {
            Image(systemName: "person.fill.checkmark")
                .font(.title2)
                .foregroundStyle(Color.brand)
                .frame(width: 44, height: 44)
                .background(Color.brandSubtle)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text("Sigue así")
                    .font(.subheadline.weight(.semibold))
                Text("¡Registra tu primera comida del día!")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(DS.Spacing.md)
        .background(Color.brandSubtle)
        .clipShape(RoundedRectangle(cornerRadius: DS.Radius.card))
    }
}
