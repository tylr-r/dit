#if targetEnvironment(simulator) || DIT_FIXTURE_TEST
import Foundation

/// Offline authenticator and conditional progress service for installed Simulator UI tests.
/// Only a UUID-scoped launch of the isolated bundle creates these files.
final class DitFixtureAccounts: DitAccountTransport, DitAccountIdentityObserver {
    private struct Record: Codable {
        var revision: Int
        var body: String
    }
    private struct Database: Codable {
        var selected: String?
        var records: [String:Record]
    }
    let directory: URL
    private let databaseURL: URL
    private var database: Database
    private var observed: ((String?) -> Void)?
    private var firstRead: String
    private var held: (() -> Void)?
    var presentation: ((String) -> Void)?
    private static let learners = ["A","B"]

    init?(environment: [String:String], bundle: String?, directory root: URL) throws {
        guard bundle == "com.tylerobinson.dit.exactspike",
              let value = environment["DIT_ACCOUNT_FIXTURE"], let run = UUID(uuidString:value) else { return nil }
        directory = root.appendingPathComponent("account-ui-fixtures",isDirectory:true)
            .appendingPathComponent(run.uuidString,isDirectory:true)
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        databaseURL = directory.appendingPathComponent("synthetic-service.json")
        firstRead = environment["DIT_ACCOUNT_FIXTURE_READ"] ?? ""
        if FileManager.default.fileExists(atPath:databaseURL.path) {
            database = try JSONDecoder().decode(Database.self,from:Data(contentsOf:databaseURL))
        } else {
            let records = Dictionary(uniqueKeysWithValues: Self.learners.map { id in
                let body = "{\"learnerProfile\":\"known\",\"nuxCompleted\":true,\"toneFrequency\":\(id == "A" ? 640 : 720),\"updatedAt\":1000}"
                return (id,Record(revision:1,body:body))
            })
            database = Database(selected:nil,records:records)
            try JSONEncoder().encode(database).write(to:databaseURL,options:.atomic)
        }
    }
    func observeIdentity(_ changed: @escaping (String?) -> Void) -> () -> Void {
        observed = changed
        notify()
        return { [weak self] in self?.observed = nil }
    }
    // The installed test checks delivery order independently of the pixels on screen.
    private func receipt(_ event: String) {
        let url = directory.appendingPathComponent("operations.txt")
        if !FileManager.default.fileExists(atPath:url.path) {
            FileManager.default.createFile(atPath:url.path,contents:nil)
        }
        if let handle = try? FileHandle(forWritingTo:url) {
            defer { try? handle.close() }
            _ = try? handle.seekToEnd()
            try? handle.write(contentsOf:Data((event + "\n").utf8))
        }
    }
    private func notify() {
        receipt("identity " + (database.selected ?? "signed-out"))
        let id = database.selected
        observed?(id)
        presentation?(id.map { "learner-" + $0.lowercased() + "@example.invalid" } ?? "")
    }
    func choose(_ command: String) {
        guard Self.learners.contains(command) || command == "sign-out" else { return }
        var next = database
        next.selected = command == "sign-out" ? nil : command
        guard persist(next) else { return }
        notify()
        if let late = held {
            held = nil
            DispatchQueue.main.async { late() }
        }
    }
    private func persist(_ next: Database) -> Bool {
        do {
            try JSONEncoder().encode(next).write(to:databaseURL,options:.atomic)
            database = next
            return true
        } catch { return false }
    }
    func read(account: String, done: @escaping (DitAccountReply) -> Void) {
        guard account == database.selected, let record = database.records[account] else { done(.unavailable); return }
        let mode = firstRead
        firstRead = ""
        if mode == "reject-first" { receipt("rejected read " + account); done(.unavailable); return }
        let reply = { [weak self] in
            self?.receipt("returned " + account + " while " + (self?.database.selected ?? "signed-out"))
            done(.loaded(revision:String(record.revision),json:record.body))
        }
        if mode == "hold-first" { receipt("held read " + account); held = reply } else { reply() }
    }
    func save(account: String, replacing revision: String, json: String, done: @escaping (DitAccountReply) -> Void) {
        guard account == database.selected, let record = database.records[account] else { done(.unavailable); return }
        guard revision == String(record.revision) else { done(.conflict); return }
        var next = database
        let saved = Record(revision:record.revision+1,body:json)
        next.records[account] = saved
        guard persist(next) else { done(.unavailable); return }
        receipt("saved " + account + " revision " + String(saved.revision))
        done(.saved(revision:String(saved.revision)))
    }
}
#endif
