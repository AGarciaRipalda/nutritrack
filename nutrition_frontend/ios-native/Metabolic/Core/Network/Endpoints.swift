import Foundation

enum Endpoint {
    static let baseURL = "https://api.metabolic.es"

    case authLogin
    case authMe
    case dashboard
    case dietToday
    case dietWeekly
    case dietRegenerateToday
    case weightHistory
    case logWeight
    case workouts
    case routines
    case gymHistory   // v2: not used in v1, reserved for future Importar feature
    case profile
    case preferences

    var path: String {
        switch self {
        case .authLogin:            return "/auth/login"
        case .authMe:               return "/auth/me"
        case .dashboard:            return "/dashboard"
        case .dietToday:            return "/diet/today"
        case .dietWeekly:           return "/diet/weekly"
        case .dietRegenerateToday:  return "/diet/today/regenerate"
        case .weightHistory:        return "/weight/history"
        case .logWeight:            return "/weight"
        case .workouts:             return "/v2/training/workouts"
        case .routines:             return "/v2/training/routines"
        case .gymHistory:           return "/exercise/gym-history"
        case .profile:              return "/profile"
        case .preferences:          return "/preferences"
        }
    }

    var url: URL {
        guard let url = URL(string: Endpoint.baseURL + path) else {
            preconditionFailure("Invalid URL for endpoint \(self): \(Endpoint.baseURL + path)")
        }
        return url
    }
}
