import Foundation

enum ViewState<T>: Sendable where T: Sendable {
    case idle
    case loading
    case loaded(T)
    case error(String)
}
