import SwiftUI

struct AjustesView: View {
    @State private var viewModel = AjustesViewModel()
    @Environment(\.colorScheme) private var colorScheme
    @AppStorage("prefersDarkMode") private var prefersDarkMode: Bool = false

    // Add fields
    @State private var newExcluded = ""
    @State private var newFavorite = ""
    @State private var newDisliked = ""

    var body: some View {
        NavigationStack {
            Form {
                // MARK: — Apariencia
                Section {
                    Toggle(isOn: $prefersDarkMode) {
                        Label("Modo claro", systemImage: "sun.max")
                    }
                    .tint(Color.brand)
                } header: {
                    Text("Apariencia")
                }

                // MARK: — Información personal
                Section {
                    TextField("Nombre", text: $viewModel.name)
                    Picker("Género", selection: $viewModel.gender) {
                        Text("Hombre").tag("Hombre")
                        Text("Mujer").tag("Mujer")
                        Text("Otro").tag("Otro")
                    }
                    Stepper("Edad: \(viewModel.age)", value: $viewModel.age, in: 10...100)
                    Stepper("Altura: \(viewModel.heightCm) cm", value: $viewModel.heightCm, in: 100...250)
                    HStack {
                        Text("Peso")
                        Spacer()
                        TextField("75.0", value: $viewModel.weightKg, format: .number)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 70)
                        Text("kg")
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Text("Información personal")
                }

                // MARK: — Objetivos
                Section {
                    Picker("Meta", selection: $viewModel.goal) {
                        Text("Perder peso").tag("lose")
                        Text("Mantener").tag("maintain")
                        Text("Ganar músculo").tag("gain")
                    }
                    Picker("Actividad", selection: $viewModel.activityLevel) {
                        Text("Sedentario").tag("sedentary")
                        Text("Ligeramente activo").tag("light")
                        Text("Moderadamente activo").tag("moderate")
                        Text("Muy activo").tag("active")
                        Text("Extremadamente activo").tag("very_active")
                    }
                } header: {
                    Text("Objetivos")
                }

                // MARK: — Macros
                Section {
                    LabeledContent("Calorías/día", value: "\(viewModel.caloriesPerDay) kcal")
                    LabeledContent("Proteína", value: "\(viewModel.proteinG) g")
                    LabeledContent("Carbos", value: "\(viewModel.carbsG) g")
                    LabeledContent("Grasas", value: "\(viewModel.fatG) g")
                } header: {
                    Text("Macronutrientes (calculado por el servidor)")
                }

                // MARK: — Preferencias alimentarias
                Section {
                    tagsSubsection(
                        title: "Excluidos (alergias)",
                        icon: "exclamationmark.circle",
                        tags: viewModel.excluded,
                        newValue: $newExcluded,
                        list: \.excluded
                    )
                    tagsSubsection(
                        title: "Favoritos",
                        icon: "heart",
                        tags: viewModel.favorites,
                        newValue: $newFavorite,
                        list: \.favorites
                    )
                    tagsSubsection(
                        title: "No me gusta",
                        icon: "hand.thumbsdown",
                        tags: viewModel.disliked,
                        newValue: $newDisliked,
                        list: \.disliked
                    )
                } header: {
                    Text("Preferencias alimentarias")
                }

                // MARK: — Save button
                Section {
                    Button {
                        Task { await viewModel.save() }
                    } label: {
                        HStack {
                            Spacer()
                            if viewModel.isSaving {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Label("Guardar ajustes", systemImage: "checkmark.circle")
                            }
                            Spacer()
                        }
                    }
                    .foregroundStyle(.white)
                    .listRowBackground(Color.brand)
                    .disabled(viewModel.isSaving)
                }
            }
            .navigationTitle("Ajustes")
            .navigationSubtitle("Perfil y preferencias")
            .task { await viewModel.load() }
            .alert("Error al cargar", isPresented: Binding(
                get: { viewModel.loadError != nil },
                set: { if !$0 { viewModel.loadError = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.loadError ?? "")
            }
            .alert("Error al guardar", isPresented: Binding(
                get: { viewModel.saveError != nil },
                set: { if !$0 { viewModel.saveError = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.saveError ?? "")
            }
        }
        .preferredColorScheme(prefersDarkMode ? .dark : .light)
    }

    // MARK: — Tags Subsection
    @ViewBuilder
    private func tagsSubsection(
        title: String,
        icon: String,
        tags: [String],
        newValue: Binding<String>,
        list: ReferenceWritableKeyPath<AjustesViewModel, [String]>
    ) -> some View {
        VStack(alignment: .leading, spacing: DS.Spacing.sm) {
            Label(title, systemImage: icon)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color.brand)

            if !tags.isEmpty {
                FlowLayout(spacing: DS.Spacing.xs) {
                    ForEach(tags, id: \.self) { tag in
                        tagChip(tag, list: list)
                    }
                }
            }

            HStack {
                TextField("Añadir...", text: newValue)
                    .font(.subheadline)
                Button {
                    viewModel.addToList(list, value: newValue.wrappedValue)
                    newValue.wrappedValue = ""
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(Color.brand)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, DS.Spacing.xs)
    }

    private func tagChip(_ tag: String, list: ReferenceWritableKeyPath<AjustesViewModel, [String]>) -> some View {
        HStack(spacing: 4) {
            Text(tag)
                .font(.caption)
            Button {
                viewModel.removeFromList(list, value: tag)
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2)
            }
            .buttonStyle(.plain)
        }
        .foregroundStyle(Color.brand)
        .padding(.horizontal, DS.Spacing.sm)
        .padding(.vertical, DS.Spacing.xs)
        .background(Color.brandSubtle)
        .clipShape(Capsule())
    }
}
