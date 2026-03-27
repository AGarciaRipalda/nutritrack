import SwiftUI
import Charts

struct ProgresoView: View {
    @State private var viewModel = ProgresoViewModel()

    private static let entryDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let longDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "d 'de' MMMM"
        f.locale = Locale(identifier: "es_ES")
        return f
    }()

    private static let shortDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "d MMM"
        f.locale = Locale(identifier: "es_ES")
        return f
    }()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DS.Spacing.lg) {
                    currentWeightCard
                    evolutionChart
                    historialSection
                }
                .padding(.horizontal, DS.Spacing.md)
                .padding(.top, DS.Spacing.sm)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Progreso")
            .navigationSubtitle("Seguimiento de peso")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    PillButton("Registrar", icon: "plus") {
                        viewModel.prepareForLogging()
                        viewModel.showLogSheet = true
                    }
                }
            }
            .task { await viewModel.load() }
            .sheet(isPresented: $viewModel.showLogSheet) {
                logWeightSheet
            }
            .alert("Error", isPresented: Binding(
                get: { viewModel.logError != nil },
                set: { if !$0 { viewModel.logError = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.logError ?? "")
            }
        }
    }

    // MARK: — Current Weight Card
    private var currentWeightCard: some View {
        GlassCard {
            HStack(spacing: DS.Spacing.md) {
                Image(systemName: "scalemass")
                    .font(.title2)
                    .foregroundStyle(Color.brand)
                    .frame(width: 44, height: 44)
                    .background(Color.brandSubtle)
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 4) {
                    if let entry = viewModel.currentEntry {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text(String(format: "%.1f kg", entry.weightKg))
                                .font(.title.bold().monospacedDigit())
                            if let change = entry.changeFromLast {
                                Text(String(format: "%+.1f kg", change))
                                    .font(.subheadline)
                                    .foregroundStyle(change <= 0 ? Color.brand : Color.metricBpm)
                            }
                        }
                        Text(formattedDate(entry.date))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Sin datos")
                            .font(.title.bold())
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }
        }
    }

    private func formattedDate(_ dateStr: String) -> String {
        guard let date = ProgresoView.entryDateFormatter.date(from: dateStr) else { return dateStr }
        return ProgresoView.longDateFormatter.string(from: date)
    }

    // MARK: — Evolution Chart
    @ViewBuilder
    private var evolutionChart: some View {
        if !viewModel.chartEntries.isEmpty {
            GlassCard {
                VStack(alignment: .leading, spacing: DS.Spacing.sm) {
                    Text("Evolución")
                        .font(.headline)

                    Chart(viewModel.chartEntries) { entry in
                        LineMark(
                            x: .value("Fecha", entry.date),
                            y: .value("Peso", entry.weightKg)
                        )
                        .foregroundStyle(Color.brand)
                        .interpolationMethod(.catmullRom)

                        PointMark(
                            x: .value("Fecha", entry.date),
                            y: .value("Peso", entry.weightKg)
                        )
                        .foregroundStyle(Color.brand)
                    }
                    .chartYScale(domain: chartYDomain)
                    .frame(height: 180)
                }
            }
        }
    }

    private var chartYDomain: ClosedRange<Double> {
        let weights = viewModel.chartEntries.map { $0.weightKg }
        guard let min = weights.min(), let max = weights.max() else { return 75...85 }
        let padding = (max - min) * 0.2 + 1
        return (min - padding)...(max + padding)
    }

    // MARK: — History Section
    private var historialEntries: [WeightEntry] {
        viewModel.chartEntries.reversed() // newest first for history list
    }

    @ViewBuilder
    private var historialSection: some View {
        if !viewModel.chartEntries.isEmpty {
            GlassCard {
                VStack(alignment: .leading, spacing: DS.Spacing.sm) {
                    Text("Historial")
                        .font(.headline)

                    ForEach(historialEntries) { entry in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(String(format: "%.1f kg", entry.weightKg))
                                    .font(.body.bold().monospacedDigit())
                                Text("Peso en ayunas")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(shortDate(entry.date))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 2)

                        if entry.id != historialEntries.last?.id {
                            Divider()
                        }
                    }
                }
            }
        }
    }

    private func shortDate(_ dateStr: String) -> String {
        guard let date = ProgresoView.entryDateFormatter.date(from: dateStr) else { return dateStr }
        return ProgresoView.shortDateFormatter.string(from: date)
    }

    // MARK: — Log Weight Sheet
    private var logWeightSheet: some View {
        NavigationStack {
            Form {
                Section("Peso") {
                    HStack {
                        Text("Kilogramos")
                        Spacer()
                        TextField("80.0", value: $viewModel.logWeight, format: .number)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 80)
                    }
                }
                Section("Fecha") {
                    DatePicker("Fecha del registro", selection: $viewModel.logDate, displayedComponents: .date)
                        .datePickerStyle(.compact)
                }
            }
            .navigationTitle("Registrar peso")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancelar") {
                        viewModel.showLogSheet = false
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Guardar") {
                        Task { await viewModel.logWeightEntry() }
                    }
                    .foregroundStyle(Color.brand)
                    .disabled(viewModel.isLogging)
                }
            }
        }
        .presentationDetents([.medium])
    }
}
