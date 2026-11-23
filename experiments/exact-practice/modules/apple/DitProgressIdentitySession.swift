import Foundation

/// Adapts a trusted provider's ordered main-queue user/token notifications.
/// The subscription delivers its first snapshot after identity restoration and
/// every sign-out/switch thereafter. The token getter belongs to that exact user.
final class DitProgressIdentitySession: DitProgressAuthOwner {
    typealias Subscribe = (@escaping (DitProgressUser?) -> Void) -> () -> Void

    private final class Login: DitProgressUser {
        let uid: String
        var providerUser: DitProgressUser?

        init(_ user: DitProgressUser) {
            uid = user.uid
            providerUser = user
        }

        @MainActor func idToken() async throws -> String {
            // A provider can refresh this login while the old lookup is suspended.
            // Retry once with its replacement. A revoked login never acquires a new user.
            for _ in 0..<2 {
                guard let user = providerUser else { break }
                do {
                    let token = try await user.idToken()
                    if providerUser === user { return token }
                } catch {
                    if providerUser === user { throw error }
                }
            }
            throw URLError(.cancelled)
        }
    }

    let databaseRoot: URL
    private let subscribe: Subscribe
    private var login: Login?
    var currentProgressUser: DitProgressUser? { login }
    private var listeners: [UUID:(String?) -> Void] = [:]
    private var unsubscribe: (() -> Void)?
    private var subscriptionID = UUID()
    private var restored = false

    init(databaseRoot: URL, subscribe: @escaping Subscribe) {
        self.databaseRoot = databaseRoot
        self.subscribe = subscribe
    }

    func observeIdentity(_ changed: @escaping (String?) -> Void) -> () -> Void {
        dispatchPrecondition(condition:.onQueue(.main))
        let id = UUID()
        listeners[id] = changed
        if listeners.count == 1 {
            let ticket = subscriptionID
            unsubscribe = subscribe { [weak self] user in
                dispatchPrecondition(condition:.onQueue(.main))
                guard let self, self.subscriptionID == ticket else { return }
                self.receive(user)
            }
        } else if restored {
            changed(login?.uid)
        }
        return { [weak self] in
            dispatchPrecondition(condition:.onQueue(.main))
            guard let self, self.listeners.removeValue(forKey:id) != nil, self.listeners.isEmpty else { return }
            self.subscriptionID = UUID()
            self.login?.providerUser = nil
            self.login = nil
            self.restored = false
            let stop = self.unsubscribe
            self.unsubscribe = nil
            stop?()
        }
    }

    private func receive(_ user: DitProgressUser?) {
        if restored && login?.uid == user?.uid {
            login?.providerUser = user
            return
        }
        restored = true
        login?.providerUser = nil
        login = user.map(Login.init)
        for id in Array(listeners.keys) { listeners[id]?(login?.uid) }
    }

    deinit {
        login?.providerUser = nil
        unsubscribe?()
    }
}
