#if targetEnvironment(simulator) || DIT_FIXTURE_TEST
import Foundation
import CommonCrypto

/// Offline authenticator and conditional progress service for installed Simulator UI tests.
/// Only a UUID-scoped launch of the isolated bundle creates these files.
final class DitFixtureAccounts: DitProgressDatabaseClient {
    private struct Record: Codable {
        var revision: Int
        var body: String?
        var passwordVerifier: Data?
    }
    private struct Database: Codable {
        var pendingReset: String?
        var pendingCleanup: String?
        var selected: String?
        var records: [String:Record]
    }
    let directory: URL
    private let databaseURL: URL
    private var database: Database
    private var observed: ((String?) -> Void)?
    private enum ProviderOutcome: String {
        case cancel, network, differentCredential = "different-credential", failed
        case learnerA = "A", learnerB = "B"
    }
    private let appleOutcome: ProviderOutcome?
    var appleSignInAvailable: Bool { appleOutcome != nil }
    private var googleOutcomes: [ProviderOutcome]
    var googleSignInAvailable: Bool { !googleOutcomes.isEmpty }
    private var emailTicket: UUID?
    private var emailFault: String?
    private var firstRead: String
    private let resetMode: String
    private var resetApproval: (id: String, online: Bool)?
    var resetMessage: ((String) -> Void)?
    private var deletionMode: String
    private var identityGeneration = 0
    private var deleting = false
    var deletionResult: ((String) -> Void)?
    var availableLearners: String { Self.learners.filter { database.records[$0] != nil }.joined() }
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
        appleOutcome = environment["DIT_ACCOUNT_FIXTURE_APPLE"].flatMap(ProviderOutcome.init(rawValue:))
        let steps = environment["DIT_ACCOUNT_FIXTURE_GOOGLE"]?.components(separatedBy:",") ?? []
        let outcomes = steps.compactMap(ProviderOutcome.init(rawValue:))
        googleOutcomes = outcomes.count == steps.count ? outcomes : []
        emailFault = environment["DIT_ACCOUNT_FIXTURE_EMAIL_ERROR"]
        resetMode = environment["DIT_ACCOUNT_FIXTURE_RESET"] ?? ""
        deletionMode = environment["DIT_ACCOUNT_FIXTURE_DELETE"] ?? ""
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
        try finishCleanup()
        try finishReset()
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
        presentation?(id.map(Self.address) ?? "")
    }
    func choose(_ command: String) {
        if command.hasPrefix("reset-") {
            chooseReset(command)
            return
        }
        guard database.pendingReset == nil else { resetMessage?("local-reset:error"); return }
        if command.hasPrefix("delete:") {
            deleteAccount(expectedEmail:String(command.dropFirst(7)))
            return
        }
        guard (Self.learners.contains(command) && database.records[command] != nil) || command == "sign-out" else { return }
        do { try finishCleanup() } catch { deletionResult?("cleanup"); return }
        var next = database
        next.selected = command == "sign-out" ? nil : command
        guard persist(next) else { return }
        identityGeneration += 1
        cancelEmail()
        resetApproval = nil
        notify()
        if let late = held {
            held = nil
            DispatchQueue.main.async { late() }
        }
    }
    private static func address(_ id: String) -> String {
        learners.contains(id) ? "learner-" + id.lowercased() + "@example.invalid" : id
    }

    // Email-created identities are confined to the reserved fixture domain.
    private static func validIdentity(_ id: String) -> Bool {
        if learners.contains(id) { return true }
        return id.utf8.count <= 254 &&
            id.range(of:#"^[a-z0-9][a-z0-9._+-]*@example[.]invalid$"#,options:.regularExpression) != nil
    }

    // This result models the provider boundary inside the UUID-scoped synthetic store.
    // Only the launch configuration can assign a learner to this provider.
    func submitApple() -> String {
        guard let outcome = appleOutcome, canSelectProvider else { return "failed" }
        return submit(outcome, cancellation:"cancelled")
    }

    func submitGoogle() -> String {
        guard let outcome = googleOutcomes.first, canSelectProvider else { return "failed" }
        // A script can retry in one launch. Repeating the final outcome keeps a single setting deterministic.
        if googleOutcomes.count > 1 { googleOutcomes.removeFirst() }
        // Shipped Dit maps Google chooser cancellation to its generic sign-in error.
        return submit(outcome, cancellation:"failed")
    }

    private var canSelectProvider: Bool {
        database.selected == nil && database.pendingReset == nil && database.pendingCleanup == nil
    }

    private func submit(_ outcome: ProviderOutcome, cancellation: String) -> String {
        switch outcome {
        case .cancel: return cancellation
        case .network, .differentCredential, .failed: return outcome.rawValue
        case .learnerA, .learnerB:
            choose(outcome.rawValue)
            return database.selected == outcome.rawValue ? "ok" : "failed"
        }
    }

    func cancelEmail() { emailTicket = nil }

    func submitEmail(create: Bool, address: String, password: String, done: @escaping (String) -> Void) {
        guard emailTicket == nil, database.selected == nil, database.pendingReset == nil,
              database.pendingCleanup == nil else { return }
        let ticket = UUID()
        emailTicket = ticket
        let email = address.trimmingCharacters(in:.whitespacesAndNewlines).lowercased()
        let id = Self.learners.first(where:{ Self.address($0) == email }) ?? email
        let record = database.records[id]
        let salt = Data((directory.lastPathComponent + ":" + id).utf8)
        let fault = emailFault
        emailFault = nil
        // Do any verifier work away from the UI. Dismissal or a new identity
        // invalidates the ticket before a reply can commit either operation.
        DispatchQueue.global(qos:.userInitiated).async { [weak self] in
            var error: String?
            var verifier: Data?
            if let fault {
                switch fault {
                case "network": error = create ? "A network error interrupted sign-up. Try again on a stable connection." : "A network error interrupted sign-in. Try again on a stable connection."
                case "disabled" where !create: error = "This account has been disabled."
                case "throttled" where !create: error = "Too many attempts. Try again in a few minutes."
                default: error = create ? "We could not create your account. Please try again." : "We could not sign you in. Please try again."
                }
            } else if email.range(of:#"^[^@\s]+@[^@\s]+[.][^@\s]+$"#,options:.regularExpression) == nil {
                error = "That email address is not valid."
            } else if !Self.validIdentity(id) {
                error = create ? "We could not create your account. Please try again." : "Email or password is incorrect."
            } else if create && record != nil {
                error = "An account already exists for that email. Sign in instead."
            } else if create && password.utf16.count < 6 {
                error = "Password is too weak. Use at least 6 characters."
            } else if create || record?.passwordVerifier != nil {
                verifier = Self.verifier(password,salt:salt)
                if verifier == nil { error = create ? "We could not create your account. Please try again." : "We could not sign you in. Please try again." }
                else if !create && verifier != record?.passwordVerifier { error = "Email or password is incorrect." }
            } else if record == nil || !Self.learners.contains(id) || password != "dit-fixture" {
                error = "Email or password is incorrect."
            }
            let result = error
            let savedVerifier = verifier
            DispatchQueue.main.async { [weak self] in
                guard let self, self.emailTicket == ticket else { return }
                self.emailTicket = nil
                if let result { done(result); return }
                var next = self.database
                if create { next.records[id] = Record(revision:1,body:nil,passwordVerifier:savedVerifier) }
                next.selected = id
                guard self.persist(next) else {
                    done(create ? "We could not create your account. Please try again." : "We could not sign you in. Please try again.")
                    return
                }
                self.identityGeneration += 1
                self.resetApproval = nil
                done("ok")
                self.notify()
            }
        }
    }

    private static func verifier(_ password: String, salt: Data) -> Data? {
        let bytes = Array(password.utf8CString)
        let saltBytes = [UInt8](salt)
        var hash = [UInt8](repeating:0,count:32)
        let result = CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2), bytes, bytes.count-1,
            saltBytes,saltBytes.count,CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),120_000,&hash,32)
        return result == kCCSuccess ? Data(hash) : nil
    }

    private func chooseReset(_ command: String) {
        guard !deleting, let id = database.selected, Self.validIdentity(id),
              database.records[id] != nil, database.pendingCleanup == nil, database.pendingReset == nil else { return }
        let email = Self.address(id)
        if command == "reset-check:" + email {
            let online = resetMode != "offline"
            resetApproval = (id,online)
            resetMessage?("account-reset:" + (online ? "online:" : "offline:") + email)
            return
        }
        guard let approval = resetApproval, approval.id == id,
              command == (approval.online ? "reset-online:" : "reset-device:") + email else { return }
        resetApproval = nil
        var next = database
        next.pendingReset = id
        guard persist(next) else { resetMessage?("local-reset:error"); return }
        do {
            try finishReset(clearRemote:approval.online && resetMode != "remote-error")
            identityGeneration += 1
            held = nil
            notify()
        } catch {
            // A reported local failure leaves the learner signed in to retry.
            // Even if this write fails, cold recovery can only clear device data.
            var failed = database
            failed.pendingReset = nil
            _ = persist(failed)
            resetMessage?("local-reset:error")
        }
    }

    // Complete the explicitly authorized reset before a restart can hydrate an old
    // snapshot. Cold recovery never issues a deferred cloud clear.
    private func finishReset(clearRemote: Bool = false) throws {
        guard let id = database.pendingReset else { return }
        guard id == database.selected, Self.validIdentity(id),
              var record = database.records[id], database.pendingCleanup == nil else {
            throw DitLegacyStore.Failure.invalid
        }
        try DitLegacyStore.resetLocal(in:directory.appendingPathComponent("dit-practice"),
                                      keys:DitAppleSession.writableKeys,starting:true)
        let accounts = directory.appendingPathComponent("dit-accounts",isDirectory:true)
        let file = accounts.appendingPathComponent(DitAccountFile.identifier(id) + ".json")
        // An empty clean snapshot lets the next sign-in load a preserved server
        // record. Importing the new Welcome file would give it a newer local timestamp.
        try Data(#"{"version":1,"records":{},"dirty":false,"updatedAt":null}"#.utf8).write(to:file,options:.atomic)
        var next = database
        if clearRemote {
            record.body = nil
            record.revision += 1
            next.records[id] = record
        }
        next.selected = nil
        next.pendingReset = nil
        guard persist(next) else { throw DitLegacyStore.Failure.unreadable }
    }

    private func deleteAccount(expectedEmail: String) {
        guard !deleting, let id = database.selected, Self.validIdentity(id),
              database.records[id] != nil,
              expectedEmail == Self.address(id) else { return }
        deleting = true
        let generation = identityGeneration
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            defer { self.deleting = false }
            guard self.identityGeneration == generation, self.database.selected == id else { return }
            let mode = self.deletionMode
            self.deletionMode = ""
            if ["cancelled","recent-login","apple-mismatch","user-mismatch","network","failed"].contains(mode) {
                self.deletionResult?(mode)
                return
            }
            // Shipped Dit clears synced progress before deleting the identity. A
            // provider refusal at the latter stage leaves the private learner signed in.
            if mode == "delete-user-recent-login", var remote = self.database.records[id] {
                remote.body = nil
                remote.revision += 1
                var partial = self.database
                partial.records[id] = remote
                self.deletionResult?(self.persist(partial) ? "recent-login" : "failed")
                return
            }
            // A successful fixture request commits the final service state atomically.
            // Persist which private learner needs cleanup before changing its files.
            var next = self.database
            next.selected = nil
            next.records.removeValue(forKey:id)
            next.pendingCleanup = id
            guard self.persist(next) else { self.deletionResult?("failed"); return }
            self.identityGeneration += 1
            self.held = nil
            let outcome: String
            do {
                try self.finishCleanup(simulateFailure:mode == "cleanup")
                outcome = "deleted"
            } catch { outcome = "cleanup" }
            self.notify()
            // Let the observer reset the prior learner's view before presenting a warning.
            DispatchQueue.main.async { [weak self] in self?.deletionResult?(outcome) }
        }
    }

    private func finishCleanup(simulateFailure: Bool = false) throws {
        guard let id = database.pendingCleanup else { return }
        guard Self.validIdentity(id), database.records[id] == nil, database.selected == nil else {
            throw DitLegacyStore.Failure.invalid
        }
        let accounts = directory.appendingPathComponent("dit-accounts",isDirectory:true)
        let digest = DitAccountFile.identifier(id)
        let owner = accounts.appendingPathComponent("anonymous-owner")
        if FileManager.default.fileExists(atPath:owner.path),
           try Data(contentsOf:owner) == Data(digest.utf8) {
            try DitLegacyStore.resetLocal(in:directory.appendingPathComponent("dit-practice"),
                                          keys:DitAppleSession.writableKeys,starting:true)
            guard unlink(owner.path) == 0 else { throw DitLegacyStore.Failure.unreadable }
        }
        if simulateFailure { throw DitLegacyStore.Failure.unreadable }
        // unlink never recursively removes a directory at the expected filename.
        let record = accounts.appendingPathComponent(digest + ".json")
        guard unlink(record.path) == 0 || errno == ENOENT else { throw DitLegacyStore.Failure.unreadable }
        var next = database
        next.pendingCleanup = nil
        guard persist(next) else { throw DitLegacyStore.Failure.unreadable }
    }

    private func persist(_ next: Database) -> Bool {
        do {
            try JSONEncoder().encode(next).write(to:databaseURL,options:.atomic)
            database = next
            return true
        } catch { return false }
    }
    var progressIdentity: (account: String, uid: String)? {
        guard let account = database.selected, Self.validIdentity(account) else { return nil }
        // Older fixture accounts key their local file by email. Keep that file and
        // model the separate opaque UID supplied by a real authentication provider.
        let uid = Self.learners.contains(account) ? account : "fixture-" + DitAccountFile.identifier(account)
        return (account,uid)
    }

    func readNode(at path: String, done: @escaping (DitProgressNode) -> Void) {
        guard database.pendingReset == nil, let identity = progressIdentity,
              path == "users/\(identity.uid)/progress", let record = database.records[identity.account]
        else { done(.unavailable); return }
        let account = identity.account
        let mode = firstRead
        firstRead = ""
        if mode == "reject-first" { receipt("rejected read " + account); done(.unavailable); return }
        let reply = { [weak self] in
            self?.receipt("returned " + account + " while " + (self?.database.selected ?? "signed-out"))
            do {
                let object = try record.body.map { try JSONSerialization.jsonObject(with:Data($0.utf8)) }
                done(.snapshot(revision:String(record.revision), value:object))
            } catch { done(.unavailable) }
        }
        if mode == "hold-first" { receipt("held read " + account); held = reply } else { reply() }
    }
    func replaceNode(at path: String, matching revision: String, value: [String:Any], done: @escaping (DitProgressWrite) -> Void) {
        guard database.pendingReset == nil, let identity = progressIdentity,
              path == "users/\(identity.uid)/progress", let record = database.records[identity.account]
        else { done(.unavailable); return }
        let account = identity.account
        guard revision == String(record.revision) else { done(.conflict); return }
        var next = database
        guard let bytes = try? JSONSerialization.data(withJSONObject:value,options:[.sortedKeys]) else { done(.unavailable); return }
        let saved = Record(revision:record.revision+1,body:String(decoding:bytes,as:UTF8.self),passwordVerifier:record.passwordVerifier)
        next.records[account] = saved
        guard persist(next) else { done(.unavailable); return }
        receipt("saved " + account + " revision " + String(saved.revision))
        done(.saved(revision:String(saved.revision)))
    }
}
#endif
