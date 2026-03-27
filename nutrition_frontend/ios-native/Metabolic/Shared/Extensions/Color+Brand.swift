import SwiftUI

extension Color {
    static let brand = Color(hex: "#44D7A8")
    static let brandPressed = Color(hex: "#2DB889")
    static let brandSubtle = Color(hex: "#44D7A8").opacity(0.15)
    static let brandGlass = Color(hex: "#44D7A8").opacity(0.08)

    // Dashboard semantic colors
    static let metricKcal = Color(hex: "#FF9500")
    static let metricSteps = Color(hex: "#44D7A8")
    static let metricTime = Color(hex: "#FFCC00")
    static let metricBpm = Color(hex: "#FF3B30")

    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
