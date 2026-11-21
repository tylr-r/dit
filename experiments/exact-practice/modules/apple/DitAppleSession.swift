import Foundation
import JavaScriptCore

/// Drives the same local Dit reducers as the web app in Apple's JavaScriptCore.
final class DitAppleSession {
    typealias Schedule = (Double, @escaping () -> Void) -> () -> Void
    private let context: JSContext
    private var adapter: JSValue?
    private var accountFile: DitAccountFile?
    private let identityOwner: DitAccountIdentityObserver?
    private var cancelIdentityObservation: (() -> Void)?
    private var accountEpoch = 0
    private var select: ((String?) -> Bool)?
    private var latestProps: [String:String]?
    private var interrupted = false
    private var reminderRequest: Int?
    private var generation = 0
    private var resetRequested = false
    private var resetLocal: (() -> Void)?
    private var jobs: [Int: () -> Void] = [:]
    private var messages: [String] = []
    private var flushing = false
    private var failed = false
    private var closed = false
    private let publish: (String) -> Void
    private let configure: (Bool, Double, Float, Bool) -> Void

    init?(directory: URL, legacyDirectory: URL? = nil, onLegacyHold: () -> Void = {}, program: URL?, accountService: DitAccountTransport? = nil, accountClock: @escaping () -> Double = { floor(Date().timeIntervalSince1970 * 1000) }, notifications: DitReminderNotifications?, outputVolume: @escaping () -> Double, schedule: @escaping Schedule,
          play: @escaping ([[Double]], Float, Int) -> Bool,
          passageStart: @escaping ([[Double]], Float, Double) -> Bool = { _,_,_ in false },
          passageControl: @escaping (String) -> Bool = { _ in false }, passagePosition: @escaping () -> Double = { -1 },
          promptTailMs: @escaping (Int) -> Double?, stop: @escaping () -> Void,
          warm: @escaping () -> Void, cancelInput: @escaping () -> Void,
          configure: @escaping (Bool, Double, Float, Bool) -> Void, publish: @escaping (String) -> Void) {
        guard let program, let source = try? String(contentsOf: program, encoding: .utf8),
              let context = JSContext() else { return nil }
        self.identityOwner = accountService as? DitAccountIdentityObserver
        self.context = context
        self.publish = publish
        self.configure = configure
        // No production containers, platform preferences or dynamic paths.
        let keys: Set<String> = ["practice", "guided", "onboarding", "method", "reminder", "haptics", "listen", "custom", "intro-hint"]
            .reduce(into: []) { $0.insert("dit.exact-spike." + $1 + ".v1") }
        let store = directory.appendingPathComponent("dit-practice", isDirectory: true)
        var holdWrites = false
        do { try DitLegacyStore.resetLocal(in: store, keys: keys, starting: false) }
        catch { onLegacyHold(); return nil }
        let read: @convention(block) (String) -> [String] = { key in
            guard keys.contains(key) || key == "dit.exact-spike.legacy.v1" else { return ["unavailable"] }
            let file = store.appendingPathComponent(key)
            do {
                let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize
                guard let size, size <= 1_000_000 else { return ["unavailable"] }
                return ["ok", try String(contentsOf: file, encoding: .utf8)]
            } catch let error as NSError {
                return error.domain == NSCocoaErrorDomain && error.code == NSFileReadNoSuchFileError
                    ? ["missing"] : ["unavailable"]
            }
        }
        let write: @convention(block) (String, String) -> Bool = { key, value in
            guard !holdWrites, keys.contains(key), value.utf8.count <= 1_000_000 else { return false }
            do {
                try FileManager.default.createDirectory(at: store, withIntermediateDirectories: true)
                try value.write(to: store.appendingPathComponent(key), atomically: true, encoding: .utf8)
                return true
            } catch { return false }
        }
        let host = JSValue(newObjectIn: context)!
        func bind(_ name: String, _ block: Any) {
            host.setObject(block, forKeyedSubscript: name as NSString)
        }
        bind("requestReminder", { [weak self] (id: Int) in
            let ticket = self?.generation
            self?.reminderRequest = id
            let result = { [weak self] (status: String) in
                DispatchQueue.main.async { [weak self] in
                    guard let self, self.generation == ticket, self.reminderRequest == id else { return }
                    self.reminderRequest = nil
                    self.call("permissionResult", [id, status])
                }
            }
            guard let notifications else { result("error"); return }
            notifications.authorize(wanted: { [weak self] in self?.generation == ticket && self?.reminderRequest == id }, done: result)
        } as @convention(block) (Int) -> Void)
        bind("cancelReminderRequest", { [weak self] in self?.reminderRequest = nil } as @convention(block) () -> Void)
        bind("syncReminder", { [weak self] (id: Int, deadline: Double, body: String) in
            let ticket = self?.generation
            let result = { [weak self] (status: String) in
                DispatchQueue.main.async { [weak self] in
                    guard let self, self.generation == ticket else { return }
                    self.call("scheduleResult",[id,status])
                }
            }
            guard let notifications else { if deadline > 0 { result("error") }; return }
            notifications.sync(deadline: deadline, body: body, done: result)
        } as @convention(block) (Int, Double, String) -> Void)
        bind("monotonicMs", { ProcessInfo.processInfo.systemUptime * 1000 } as @convention(block) () -> Double)
        bind("requestLocalReset", { [weak self] in self?.resetRequested = true } as @convention(block) () -> Void)
        bind("wallTime", accountClock as @convention(block) () -> Double)
        bind("accountCommit", { [weak self] (json: String) in self?.accountFile?.commit(json) ?? false } as @convention(block) (String) -> Bool)
        bind("invalidateLocal", { [weak self] in
            guard let self else { return }
            self.generation += 1
            self.reminderRequest = nil
            cancelInput()
            stop()
        } as @convention(block) () -> Void)
        bind("accountRequest", { [weak self] (id: Int, kind: String, revision: String, json: String) in
            guard let self, let file = self.accountFile, let accountService else { return }
            let epoch = self.accountEpoch
            let done: (DitAccountReply) -> Void = { [weak self] reply in
                DispatchQueue.main.async { [weak self] in
                    guard let self, !self.closed, self.accountEpoch == epoch else { return }
                    switch reply {
                    case .loaded(let token, let json): self.call("accountResult",[id,"ok",token,json ?? ""])
                    case .saved(let token): self.call("accountResult",[id,"ok",token,""])
                    case .conflict: self.call("accountResult",[id,"conflict","",""])
                    case .unavailable: self.call("accountResult",[id,"error","",""])
                    }
                }
            }
            if kind == "read" { accountService.read(account:file.identity,done:done) }
            else if kind == "save" { accountService.save(account:file.identity,replacing:revision,json:json,done:done) }
        } as @convention(block) (Int,String,String,String) -> Void)
        bind("read", read)
        bind("write", write)
        bind("project", { [weak self] (message: String) in self?.messages.append(message) } as @convention(block) (String) -> Void)
        bind("schedule", { [weak self] (id: Int, delay: Double) in
            let ticket = self?.generation
            self?.jobs[id] = schedule(delay) { [weak self] in
                guard let self, self.generation == ticket else { return }
                self.jobs.removeValue(forKey: id)
                self.call("timer", [id])
            }
        } as @convention(block) (Int, Double) -> Void)
        bind("cancelTimer", { [weak self] (id: Int) in self?.jobs.removeValue(forKey: id)?() } as @convention(block) (Int) -> Void)
        bind("play", { (plan: [[Double]], pitch: Double, id: Int) in play(plan, Float(pitch), id) } as @convention(block) ([[Double]], Double, Int) -> Bool)
        bind("passageStart", { (plan: [[Double]], pitch: Double, gap: Double) in passageStart(plan, Float(pitch), gap) } as @convention(block) ([[Double]], Double, Double) -> Bool)
        bind("passageControl", passageControl as @convention(block) (String) -> Bool)
        bind("passagePosition", passagePosition as @convention(block) () -> Double)
        bind("promptTailMs", { (id: Int) in promptTailMs(id) ?? -1 } as @convention(block) (Int) -> Double)
        bind("outputVolume", { outputVolume() } as @convention(block) () -> Double)
        bind("stop", { stop() } as @convention(block) () -> Void)
        bind("warm", { warm() } as @convention(block) () -> Void)
        bind("cancelInput", { cancelInput() } as @convention(block) () -> Void)
        context.evaluateScript(source, withSourceURL: program)
        guard context.exception == nil else { return nil }
        let library = context.objectForKeyedSubscript("DitSession")
        func converted(_ values: [String:String]) throws -> [String:String] {
            let result = library?.invokeMethod("convertLegacy", withArguments:[values])
            guard context.exception == nil, let output = result?.toDictionary() as? [String:String] else {
                context.exception = nil
                throw DitLegacyStore.Failure.invalid
            }
            return output
        }
        if let legacyDirectory {
            do { try DitLegacyStore.install(from:legacyDirectory, into:store, writableKeys:keys, convert:converted) }
            catch { onLegacyHold(); return nil }
        }
        // Before revision-aware imports, file dates only described the copy. Compare
        // the allowlisted original with this app's current syncable projection once.
        func originalAccountTime(_ records: [String:String]) throws -> Int64? {
            let key = "dit.exact-spike.legacy.v1"
            guard let raw = records[key] else { return nil }
            guard let receipt = try JSONSerialization.jsonObject(with:Data(raw.utf8)) as? [String:Any],
                  receipt["version"] as? Int == 1 else { throw DitLegacyStore.Failure.invalid }
            guard receipt["accountFileTimes"] as? Bool != true,
                  let stamp = receipt["sourceUpdatedAt"] as? NSNumber else { return nil }
            guard let legacyDirectory else { throw DitLegacyStore.Failure.unreadable }
            let imported = try converted(DitLegacyStore.readLegacy(legacyDirectory))
            guard let saved = imported[key],
                  let expected = try JSONSerialization.jsonObject(with:Data(saved.utf8)) as? NSDictionary,
                  expected.isEqual(to:receipt) else { throw DitLegacyStore.Failure.invalid }
            func wire(_ values: [String:String]) throws -> NSDictionary {
                let result = library?.invokeMethod("accountPayload",withArguments:[values])
                guard context.exception == nil, let obj = result?.toDictionary() as NSDictionary? else {
                    context.exception = nil
                    throw DitLegacyStore.Failure.invalid
                }
                return obj
            }
            return try wire(records).isEqual(wire(imported)) ? stamp.int64Value : nil
        }
        resetLocal = { [weak self] in
            guard let self else { return }
            holdWrites = true
            do { try DitLegacyStore.resetLocal(in:store, keys:keys, starting:true) }
            catch { self.messages.append("local-reset:error"); return }
            self.generation += 1
            self.reminderRequest = nil
            self.adapter?.invokeMethod("dispose", withArguments:[])
            for cancel in self.jobs.values { cancel() }
            self.jobs.removeAll()
            self.messages = ["local-reset:complete"]
            holdWrites = false
            self.adapter = library?.invokeMethod("create", withArguments:[host])
            self.adapter?.invokeMethod("bootstrap", withArguments:[])
        }
        select = { [weak self] identity in
            guard let self, !self.closed else { return false }
            if !self.failed && self.adapter != nil && self.accountFile?.identity == identity { return true }
            if identity != nil && accountService == nil { return false }
            self.accountEpoch += 1
            self.generation += 1
            self.reminderRequest = nil
            self.adapter?.invokeMethod("dispose", withArguments:[])
            self.adapter = nil
            self.accountFile = nil
            for cancel in self.jobs.values { cancel() }
            self.jobs.removeAll()
            cancelInput()
            stop()
            self.messages = ["account-session:changed"]
            self.failed = false
            context.exception = nil
            do {
                if let identity {
                    let next = try DitAccountFile(directory:directory,identity:identity,
                        keys:keys.union(["dit.exact-spike.legacy.v1"]),anonymous:store,originalTime:originalAccountTime)
                    self.accountFile = next
                    self.adapter = library?.invokeMethod("createAccount",withArguments:[host,next.json])
                } else { self.adapter = library?.invokeMethod("create",withArguments:[host]) }
                guard context.exception == nil, self.adapter?.isObject == true else { throw DitLegacyStore.Failure.invalid }
            } catch {
                self.failed = true
                self.accountFile = nil
                self.messages.removeAll()
                self.configure(false,100,600,false)
                self.publish("account-session:changed")
                self.publish("account-sync:storage-unavailable")
                self.publish("apple-session:failed")
                return false
            }
            if self.interrupted { self.call("interrupt",[true]) }
            self.call("bootstrap")
            if let props = self.latestProps { self.call("setProps",[props]) }
            return !self.failed
        }
        if identityOwner == nil {
            adapter = library?.invokeMethod("create", withArguments: [host])
            guard context.exception == nil, adapter?.isObject == true else { return nil }
        }
    }

    private func call(_ name: String, _ arguments: [Any] = []) {
        guard !closed, !failed, let adapter else { return }
        adapter.invokeMethod(name, withArguments: arguments)
        if resetRequested {
            resetRequested = false
            resetLocal?()
        }
        let state = context.exception == nil ? self.adapter?.invokeMethod("configuration", withArguments: []) : nil
        if context.exception != nil || state?.isObject != true {
            failed = true
            configure(false, 100, 600, false)
            messages = ["apple-session:failed"]
        } else if let state {
            configure(state.forProperty("enabled").toBool(), state.forProperty("unit").toDouble(),
                      Float(state.forProperty("pitch").toDouble()), state.forProperty("hapticsEnabled").toBool())
        }
        // Contract prop updates can arrive as a consequence of a publication.
        guard !flushing else { return }
        flushing = true
        while !closed && !messages.isEmpty {
            let batch = messages
            messages.removeAll(keepingCapacity: true)
            let ticket = generation
            for message in batch where !closed && generation == ticket { publish(message) }
        }
        flushing = false
    }

    func foreground() { call("foreground") }
    func bootstrap() {
        guard !closed else { return }
        guard let identityOwner else { call("bootstrap"); return }
        guard cancelIdentityObservation == nil else { return }
        // Deliver even an immediately restored identity after subscription returns. Props
        // and interruptions received before then are applied when its adapter is ready.
        cancelIdentityObservation = identityOwner.observeIdentity { [weak self] identity in
            DispatchQueue.main.async { [weak self] in _ = self?.selectAccount(identity) }
        }
    }
    /// Identity changes are delivered by an authenticated owner, never by view props.
    @discardableResult func selectAccount(_ identity: String?) -> Bool { select?(identity) ?? false }
    func setProps(_ props: [String: String]) { latestProps = props; call("setProps", [props]) }
    func input(_ kind: String, _ value: String) { call("input", [kind, value]) }
    func interrupt(_ value: Bool) { interrupted = value; call("interrupt", [value]) }
    func close() {
        guard !closed else { return }
        closed = true
        cancelIdentityObservation?()
        cancelIdentityObservation = nil
        reminderRequest = nil
        adapter?.invokeMethod("dispose", withArguments: [])
        for cancel in jobs.values { cancel() }
        jobs.removeAll()
        messages.removeAll()
        select = nil
        accountFile = nil
        resetLocal = nil
        adapter = nil
    }
}
