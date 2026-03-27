import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            Tab("Panel", systemImage: "square.grid.2x2") {
                PanelView()
            }
            Tab("Dieta", systemImage: "fork.knife") {
                DietaView()
            }
            Tab("Entreno", systemImage: "figure.run") {
                EntrenoView()
            }
            Tab("Progreso", systemImage: "chart.line.uptrend.xyaxis") {
                ProgresoView()
            }
            Tab("Ajustes", systemImage: "gearshape") {
                AjustesView()
            }
        }
    }
}
