import SwiftUI

struct PillButton: View {
    let title: String
    let icon: String?
    let action: () -> Void

    init(_ title: String, icon: String? = nil, action: @escaping () -> Void) {
        self.title = title
        self.icon = icon
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: DS.Spacing.xs) {
                if let icon {
                    Image(systemName: icon)
                        .font(.subheadline.weight(.medium))
                }
                Text(title)
                    .font(.subheadline.weight(.medium))
            }
            .foregroundStyle(Color.brand)
            .frame(height: DS.PillButton.height)
            .padding(.horizontal, DS.Spacing.md)
            .background(.regularMaterial)
            .glassEffect(.regular.tint(Color.brandGlass), in: Capsule())
        }
        .buttonStyle(.plain)
    }
}
