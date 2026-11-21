import Foundation
import Darwin
import CryptoKit

/// Read-only AsyncStorage 2.2.0 input, scoped to this app's own container.
/// Publication happens before the JavaScript session can open the Exact files.
enum DitLegacyStore {
    enum Failure: Error { case unreadable, invalid }
    private enum Key: String, CodingKey, CaseIterable {
        case status = "dit-nux-status", setup = "dit-nux-state", progress = "dit-progress"
        case hint = "dit-intro-hint-step", dismissedHint = "dit-intro-hints-dismissed"
        var isHint: Bool { self == .hint || self == .dismissedHint }
        var filename: String {
            Insecure.MD5.hash(data: Data(rawValue.utf8)).map { String(format: "%02x", $0) }.joined()
        }
    }
    private enum Entry { case inline(String), file }
    private struct Manifest: Decodable {
        let entries: [Key: Entry]
        init(from decoder: Decoder) throws {
            let fields = try decoder.container(keyedBy: Key.self)
            var result: [Key: Entry] = [:]
            // Never enumerate the manifest or decode an unrelated inline value.
            for key in Key.allCases where fields.contains(key) {
                if try fields.decodeNil(forKey: key) { result[key] = .file }
                else if key.isHint { result[key] = (try? fields.decode(String.self, forKey: key)).map(Entry.inline) }
                else { result[key] = .inline(try fields.decode(String.self, forKey: key)) }
            }
            entries = result
        }
    }

    /// Adding WidgetKit moves Exact's host data root into the App Group.
    /// Keep the learner files at the pre-widget app-private path on every launch.
    static func sessionDirectory(hostData: URL, privateSupport: URL?, bundleID: String?, agent: Bool) -> URL? {
        if agent { return hostData }
        guard let support = privateSupport, let bundleID, !bundleID.isEmpty else { return nil }
        return support.appendingPathComponent("exact", isDirectory: true)
            .appendingPathComponent(bundleID, isDirectory: true)
            .appendingPathComponent("data", isDirectory: true)
    }

    static func directory(in support: URL, bundleID: String) -> URL {
        support.appendingPathComponent(bundleID, isDirectory: true)
            .appendingPathComponent("RCTAsyncLocalStorage_V1", isDirectory: true)
    }

    private static func openDirectory(_ url: URL) throws -> Int32? {
        let fd = Darwin.open(url.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        if fd >= 0 { return fd }
        if errno == ENOENT { return nil }
        throw Failure.unreadable
    }

    private static func contains(_ name: String, in directory: Int32) throws -> Bool {
        var info = stat()
        if fstatat(directory, name, &info, AT_SYMLINK_NOFOLLOW) == 0 { return true }
        if errno == ENOENT { return false }
        throw Failure.unreadable
    }

    private static func exactExists(_ store: URL, keys: Set<String>) throws -> Bool {
        guard let fd = try openDirectory(store) else { return false }
        defer { close(fd) }
        return try keys.contains { try contains($0, in: fd) }
    }

    private static func bytes(_ name: String, in directory: Int32, limit: Int) throws -> Data {
        let fd = openat(directory, name, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC)
        guard fd >= 0 else { throw Failure.unreadable }
        let file = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
        var info = stat()
        guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFREG,
              info.st_size <= limit, let data = try file.read(upToCount: limit + 1),
              !data.isEmpty, data.count == info.st_size else { throw Failure.unreadable }
        return data
    }

    static func readLegacy(_ url: URL) throws -> [String:String] {
        // Check the bundle directory too. An alias must never turn this lookup
        // into a read from another app's bundle directory.
        guard let parent = try openDirectory(url.deletingLastPathComponent()) else { return [:] }
        defer { close(parent) }
        let fd = openat(parent, url.lastPathComponent, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        if fd < 0 && errno == ENOENT { return [:] }
        guard fd >= 0 else { throw Failure.unreadable }
        defer { close(fd) }
        if try !contains("manifest.json", in: fd) {
            // The package can create an empty directory before its first write.
            // An orphaned allowlisted blob makes a missing manifest ambiguous.
            guard try !Key.allCases.contains(where: { try !$0.isHint && contains($0.filename, in: fd) }) else { throw Failure.unreadable }
            return [:]
        }
        let manifest = try JSONDecoder().decode(Manifest.self, from: bytes("manifest.json", in: fd, limit: 4_000_000))
        func value(_ key: Key) throws -> String? {
            guard let entry = manifest.entries[key] else { return nil }
            switch entry {
            case .inline(let string): return string
            case .file:
                let data = try bytes(key.filename, in: fd, limit: 1_000_000)
                guard let string = String(data: data, encoding: .utf8) else { throw Failure.invalid }
                return string
            }
        }
        let status = try value(.status)
        var result: [String:String] = [:]
        result[Key.status.rawValue] = status
        result[Key.progress.rawValue] = try value(.progress)
        if status != "completed" && status != "skipped" { result[Key.setup.rawValue] = try value(.setup) }
        // Optional UI preferences must never hold back an existing progress import.
        if let step = try? value(.hint), ["morse","settings","done"].contains(step) {
            result[Key.hint.rawValue] = step
        } else if (try? value(.dismissedHint)) == "true" {
            result[Key.hint.rawValue] = "done"
        }
        return result
    }

    private static let resetMarker = "dit.exact-spike.reset-pending.v1"

    /// A confirmed local reset removes only the experiment records. A journal makes an
    /// interrupted reset finish before the next session can read or import progress.
    static func resetLocal(in store: URL, keys: Set<String>, starting: Bool) throws {
        if starting { try FileManager.default.createDirectory(at: store, withIntermediateDirectories: true) }
        if !starting {
            // A non-directory ancestor cannot contain the journal. Preserve the
            // existing in-memory session for unavailable app-private storage.
            var info = stat()
            if lstat(store.path,&info) != 0 && errno == ENOTDIR { return }
        }
        guard let fd = try openDirectory(store) else { return }
        defer { close(fd) }
        let pending = try contains(resetMarker, in: fd)
        guard starting || pending else { return }
        let records = keys.union(["dit.exact-spike.legacy.v1"])
        // Never recurse into a path occupying a known filename.
        for name in records.union([resetMarker]) {
            var info = stat()
            if fstatat(fd,name,&info,AT_SYMLINK_NOFOLLOW) == 0 {
                guard info.st_mode & S_IFMT == S_IFREG else { throw Failure.invalid }
            } else if errno != ENOENT { throw Failure.unreadable }
        }
        if !pending {
            let marker = openat(fd,resetMarker,O_CREAT | O_EXCL | O_WRONLY | O_CLOEXEC | O_NOFOLLOW,0o600)
            guard marker >= 0 else { throw Failure.unreadable }
            close(marker)
        }
        for name in records {
            guard unlinkat(fd,name,0) == 0 || errno == ENOENT else { throw Failure.unreadable }
        }
        // This fresh record also prevents re-importing the unchanged legacy source.
        try #"{"version":1,"status":"pending","step":"welcome"}"#.write(
            to: store.appendingPathComponent("dit.exact-spike.onboarding.v1"), atomically:true, encoding:.utf8)
        guard unlinkat(fd,resetMarker,0) == 0 else { throw Failure.unreadable }
    }

    static func install(from legacy: URL, into store: URL, writableKeys: Set<String>,
                        convert: ([String:String]) throws -> [String:String]) throws {
        let receipt = "dit.exact-spike.legacy.v1"
        let exactKeys = writableKeys.union([receipt])
        if try exactExists(store, keys: exactKeys) { return }
        let values = try readLegacy(legacy)
        guard !values.isEmpty else { return }
        var output = try convert(values)
        guard output[receipt] != nil, output["dit.exact-spike.onboarding.v1"] != nil,
              output.keys.allSatisfy({ writableKeys.contains($0) || $0 == receipt }) else { throw Failure.invalid }
        let fm = FileManager.default
        let parent = store.deletingLastPathComponent()
        try fm.createDirectory(at: parent, withIntermediateDirectories: true)
        // Foundation's replacement directory is on the target volume. A crash
        // before rename leaves only disposable staging, never an active partial store.
        let staging = try fm.url(for: .itemReplacementDirectory, in: .userDomainMask,
                                 appropriateFor: parent, create: true)
        defer { try? fm.removeItem(at: staging) }
        let prepared = staging.appendingPathComponent("dit-practice", isDirectory: true)
        try fm.createDirectory(at: prepared, withIntermediateDirectories: false)
        // Give newly imported records their source revision time. An ordinary
        // Exact write later replaces the file with the real local edit time.
        let metadata = output[receipt].flatMap { try? JSONSerialization.jsonObject(with: Data($0.utf8)) as? [String:Any] }
        if var marked = metadata {
            marked["accountFileTimes"] = true
            output[receipt] = String(decoding:try JSONSerialization.data(withJSONObject:marked),as:UTF8.self)
        }
        let sourceTime = (metadata?["sourceUpdatedAt"] as? NSNumber).map { Date(timeIntervalSince1970:$0.doubleValue / 1000) }
        for (key, value) in output {
            guard value.utf8.count <= 1_000_000 else { throw Failure.invalid }
            let url = prepared.appendingPathComponent(key)
            try Data(value.utf8).write(to: url, options: .withoutOverwriting)
            if let sourceTime { try fm.setAttributes([.modificationDate:sourceTime], ofItemAtPath:url.path) }
        }
        // POSIX directory rename can publish into an absent or empty directory.
        // A single existing file makes the kernel refuse replacement.
        if Darwin.rename(prepared.path, store.path) != 0 {
            let conflict = errno == EEXIST || errno == ENOTEMPTY
            guard conflict, try exactExists(store, keys: exactKeys) else { throw Failure.unreadable }
        }
    }
}
