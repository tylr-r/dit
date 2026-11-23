import Foundation

enum DitProgressNode {
    /// A missing node has nil value and a usable revision for a subsequent conditional save.
    case snapshot(revision: String, value: Any?)
    case unavailable
}

enum DitProgressWrite {
    case saved(revision: String)
    case conflict
    case unavailable
}

/// The client owns authentication. A replacement must atomically match the supplied revision.
protocol DitProgressDatabaseClient: DitAccountTransport, DitAccountIdentityObserver {
    /// The private store identity and the database UID supplied by its authenticated owner.
    var progressIdentity: (account: String, uid: String)? { get }
    func readNode(at path: String, done: @escaping (DitProgressNode) -> Void)
    func replaceNode(at path: String, matching revision: String, value: [String:Any], done: @escaping (DitProgressWrite) -> Void)
}

extension DitProgressDatabaseClient {
    func progressPath(for account: String) -> String? {
        guard let identity = progressIdentity, identity.account == account else { return nil }
        let uid = identity.uid
        let forbidden = CharacterSet(charactersIn: ".#$[]/")
        guard !uid.isEmpty,
              uid.unicodeScalars.allSatisfy({ $0.value >= 32 && $0.value != 127 && !forbidden.contains($0) })
        else { return nil }
        return "users/\(uid)/progress"
    }

    func read(account: String, done: @escaping (DitAccountReply) -> Void) {
        guard let path = progressPath(for:account) else { done(.unavailable); return }
        readNode(at:path) { node in
            guard case .snapshot(let revision, let value) = node, !revision.isEmpty else { done(.unavailable); return }
            guard let value, !(value is NSNull) else { done(.loaded(revision:revision,json:nil)); return }
            guard let object = value as? [String:Any], JSONSerialization.isValidJSONObject(object),
                  let bytes = try? JSONSerialization.data(withJSONObject:object)
            else { done(.unavailable); return }
            done(.loaded(revision:revision,json:String(decoding:bytes,as:UTF8.self)))
        }
    }

    func save(account: String, replacing revision: String, json: String, done: @escaping (DitAccountReply) -> Void) {
        guard let path = progressPath(for:account), !revision.isEmpty,
              let value = (try? JSONSerialization.jsonObject(with:Data(json.utf8))) as? [String:Any]
        else { done(.unavailable); return }
        replaceNode(at:path,matching:revision,value:value) { result in
            switch result {
            case .saved(let next) where !next.isEmpty: done(.saved(revision:next))
            case .conflict: done(.conflict)
            default: done(.unavailable)
            }
        }
    }
}
