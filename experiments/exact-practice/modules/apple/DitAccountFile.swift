import Foundation
import CryptoKit

/// The transport uses the active authenticated identity and conditionally replaces a
/// revision. A missing remote record still has a revision. No credentials live here.
protocol DitAccountTransport: AnyObject {
    func read(account: String, done: @escaping (DitAccountReply) -> Void)
    func save(account: String, replacing revision: String, json: String, done: @escaping (DitAccountReply) -> Void)
}
/// Auth owners deliver the restored identity first, then sign-in, switch or sign-out.
protocol DitAccountIdentityObserver: AnyObject {
    func observeIdentity(_ changed: @escaping (String?) -> Void) -> () -> Void
}
enum DitAccountReply {
    case loaded(revision: String, json: String?)
    case saved(revision: String)
    case conflict
    case unavailable
}

/// One atomic private snapshot contains the Exact records and the pending sync stamp.
/// The shared widget directory and the legacy source are never account stores.
final class DitAccountFile {
    private static let lock = NSLock()
    private let file: URL
    let identity: String
    private let keys: Set<String>
    private(set) var bytes: Data
    var json: String { String(decoding: bytes, as: UTF8.self) }

    init(directory: URL, identity: String, keys: Set<String>, anonymous: URL, originalTime: ([String:String]) throws -> Int64?) throws {
        guard !identity.isEmpty && identity.utf8.count <= 512 else { throw DitLegacyStore.Failure.invalid }
        self.identity = identity
        self.keys = keys
        let id = SHA256.hash(data: Data(identity.utf8)).map { String(format:"%02x",$0) }.joined()
        let accounts = directory.appendingPathComponent("dit-accounts", isDirectory:true)
        let owner = accounts.appendingPathComponent("anonymous-owner")
        file = accounts.appendingPathComponent(id + ".json")
        Self.lock.lock()
        defer { Self.lock.unlock() }
        let fm = FileManager.default
        try fm.createDirectory(at: accounts, withIntermediateDirectories: true)
        if let existing = try Self.read(file, limit:12_000_000) {
            bytes = existing
            try validate(existing)
            return
        }
        var records: [String:String] = [:]
        var stamp: Int64?
        let previousOwner = try Self.read(owner, limit:64)
        if previousOwner == nil || previousOwner == Data(id.utf8) {
            let privateOnly: Set<String> = ["listen","custom","intro-hint","legacy"].reduce(into:[]) {
                $0.insert("dit.exact-spike." + $1 + ".v1")
            }
            for key in keys {
                let url = anonymous.appendingPathComponent(key)
                guard let data = try Self.read(url, limit:1_000_000) else { continue }
                guard let value = String(data:data, encoding:.utf8) else { throw DitLegacyStore.Failure.invalid }
                records[key] = value
                if !privateOnly.contains(key) {
                    guard let time = try url.resourceValues(forKeys:[.contentModificationDateKey]).contentModificationDate
                    else { throw DitLegacyStore.Failure.unreadable }
                    stamp = max(stamp ?? 0, Int64((time.timeIntervalSince1970 * 1000).rounded()))
                }
            }
            if let original = try originalTime(records) { stamp = original }
            if previousOwner == nil { try Data(id.utf8).write(to:owner,options:.withoutOverwriting) }
        }
        let initial: [String:Any] = ["version":1, "records":records, "dirty":stamp != nil, "updatedAt":stamp as Any? ?? NSNull()]
        bytes = try JSONSerialization.data(withJSONObject:initial)
        try bytes.write(to:file,options:.withoutOverwriting)
    }

    private static func read(_ url: URL, limit: Int) throws -> Data? {
        do {
            let info = try url.resourceValues(forKeys:[.fileSizeKey,.isRegularFileKey,.isSymbolicLinkKey])
            guard info.isSymbolicLink != true, info.isRegularFile == true,
                  let size = info.fileSize, size <= limit else { throw DitLegacyStore.Failure.invalid }
            return try Data(contentsOf:url)
        } catch let e as NSError where e.domain == NSCocoaErrorDomain && e.code == NSFileReadNoSuchFileError { return nil }
    }

    private func validate(_ data: Data) throws {
        guard data.count <= 12_000_000,
              let obj = try JSONSerialization.jsonObject(with:data) as? [String:Any],
              Set(obj.keys) == ["version","records","updatedAt","dirty"], obj["version"] as? Int == 1,
              let records = obj["records"] as? [String:String],
              records.allSatisfy({ keys.contains($0.key) && $0.value.utf8.count <= 1_000_000 })
        else { throw DitLegacyStore.Failure.invalid }
    }

    func commit(_ json: String) -> Bool {
        Self.lock.lock()
        defer { Self.lock.unlock() }
        do {
            let next = Data(json.utf8)
            try validate(next)
            guard try Self.read(file,limit:12_000_000) == bytes else { return false }
            try next.write(to:file,options:.atomic)
            bytes = next
            return true
        } catch { return false }
    }
}
