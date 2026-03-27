import SwiftUI

struct GlassCard<Content: View>: View {
    let content: () -> Content

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        content()
            .padding(DS.Spacing.md)
            .glassEffect(.regular.tint(Color.brandGlass), in: RoundedRectangle(cornerRadius: DS.Radius.card))
    }
}
