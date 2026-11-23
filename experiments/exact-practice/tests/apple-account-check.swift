// Real JSCore session, app-private atomic files and synthetic transport in memory.
class AccountFixtureService: DitAccountTransport {
    struct Operation {
        let uid: String
        let revision: String?
        let body: String?
        let reply: (DitAccountReply) -> Void
    }
    var requests: [Operation] = []
    func read(account: String, done: @escaping (DitAccountReply) -> Void) {
        requests.append(Operation(uid:account,revision:nil,body:nil,reply:done))
    }
    func save(account: String, replacing revision: String, json: String, done: @escaping (DitAccountReply) -> Void) {
        requests.append(Operation(uid:account,revision:revision,body:json,reply:done))
    }
    func take(_ uid: String, _ rev: String? = nil) -> Operation {
        precondition(!requests.isEmpty, "missing service request for " + uid)
        let op = requests.removeFirst()
        precondition(op.uid == uid && op.revision == rev)
        return op
    }
}
private func eventTurn() { RunLoop.main.run(until:Date().addingTimeInterval(0.035)) }
private func contents(_ op: AccountFixtureService.Operation) throws -> NSDictionary {
    try JSONSerialization.jsonObject(with:Data(op.body!.utf8)) as! NSDictionary
}

private func compareAccountOrder() throws {
    let times: [Int?] = [500,nil,1000,1500]
    for (index,time) in times.enumerated() {
        let name = "signed-order-" + String(index)
        let (_,original) = try seedLegacy(name)
        let transport = AccountFixtureService()
        let f = Fixture(root.appendingPathComponent(name),asset,legacyDirectory:oldDirectory(name),accounts:transport)
        f.expect("pitch","640")
        precondition(f.session.selectAccount("synthetic-a"))
        let stamp = time.map { ",\"updatedAt\":" + String($0) } ?? ""
        transport.take("synthetic-a").reply(.loaded(revision:"r1",json:"{\"toneFrequency\":700" + stamp + "}"))
        eventTurn()
        let localWins = time == nil || time! < 1000
        f.expect("pitch",localWins ? "640" : "700")
        if localWins {
            f.advance(800)
            let save = transport.take("synthetic-a","r1")
            let body = try contents(save)
            precondition(body["updatedAt"] as? Int == 1000 && body["toneFrequency"] as? Int == 640)
            precondition(body["history"] == nil && body["guidedPackIndex"] as? Int == 2)
            save.reply(.saved(revision:"r2"))
            eventTurn()
        }
        f.expect("account-sync","current")
        f.expect("nux-status","completed")
        f.close()
        let restart = Fixture(root.appendingPathComponent(name),asset,accounts:transport)
        precondition(restart.session.selectAccount("synthetic-a"))
        restart.expect("pitch",localWins ? "640" : "700")
        restart.close()
        let after = try Data(contentsOf:oldDirectory(name).appendingPathComponent(legacyHash))
        precondition(original == after)
    }
    print("PASS native account store matches all four pinned local-1000 ordering cases, exact outbound timestamp, offline restart and unchanged legacy bytes.")
}

private func compareAccountSwitchAndRetry() throws {
    let name = "account-switch"
    let directory = root.appendingPathComponent(name)
    try seed(name,"haptics","false")
    let service = AccountFixtureService()
    let f = Fixture(directory,asset,accounts:service)
    precondition(f.session.selectAccount("first"))
    let old = service.take("first")
    precondition(f.session.selectAccount("second"))
    precondition(f.hapticsEnabled,"anonymous opt-out belongs only to its first owner")
    let other = service.take("second")
    precondition(f.session.selectAccount("first"))
    let current = service.take("first")
    old.reply(.loaded(revision:"stale",json:#"{"toneFrequency":800,"updatedAt":9000000000000}"#))
    other.reply(.loaded(revision:"stale",json:#"{"toneFrequency":760}"#))
    eventTurn()
    f.expect("pitch","600")
    precondition(!f.hapticsEnabled)
    current.reply(.loaded(revision:"empty-a",json:nil))
    eventTurn()
    f.advance(800)
    let pending = service.take("first","empty-a")
    f.set("settings-open","true")
    f.command("pref","haptics-on")
    precondition(f.hapticsEnabled)
    let oldBody = try contents(pending)
    precondition(oldBody["hapticsEnabled"] as? Bool == false)
    pending.reply(.saved(revision:"saved-a"))
    eventTurn()
    f.advance(800)
    let newer = service.take("first","saved-a")
    let newBody = try contents(newer)
    precondition(newBody["hapticsEnabled"] as? Bool == true)
    precondition((newBody["updatedAt"] as! NSNumber).int64Value > (oldBody["updatedAt"] as! NSNumber).int64Value)
    newer.reply(.unavailable)
    eventTurn()
    f.expect("account-sync","retry")
    f.advance(30000)
    let retry = service.take("first")
    f.close()
    let restarted = Fixture(directory,asset,accounts:service)
    precondition(restarted.session.selectAccount("first") && restarted.hapticsEnabled)
    retry.reply(.loaded(revision:"delayed",json:#"{"hapticsEnabled":false}"#))
    let read = service.take("first")
    read.reply(.loaded(revision:"old",json:#"{"toneFrequency":680,"updatedAt":4}"#))
    eventTurn()
    restarted.advance(800)
    let cas = service.take("first","old")
    precondition(try! contents(cas).isEqual(newBody))
    cas.reply(.conflict)
    eventTurn()
    restarted.advance(0)
    service.take("first").reply(.loaded(revision:"advanced",json:#"{"toneFrequency":740,"updatedAt":9000000000000}"#))
    eventTurn()
    restarted.expect("pitch","740")
    restarted.expect("account-sync","current")
    precondition(restarted.session.selectAccount("second"))
    restarted.expect("pitch","600")
    service.take("second").reply(.loaded(revision:"b",json:#"{"scores":{"E":8},"toneFrequency":620}"#))
    eventTurn()
    restarted.expect("pitch","620")
    restarted.expect("nux-status","skipped")
    precondition(restarted.session.selectAccount(nil))
    restarted.expect("pitch","600")
    precondition(!restarted.hapticsEnabled)
    restarted.close()
    print("PASS A→B→A delayed reads, in-flight local edit, revision conflict, failed write and retry across cold restart, anonymous sign-out and private state isolation.")
}
try compareAccountOrder()
try compareAccountSwitchAndRetry()
private func comparePreviousImportRevision() throws {
    let name = "signed-previous-import"
    _ = try seedLegacy(name)
    legacyLaunch(name).close()
    let url = file(name,"legacy")
    var receipt = try exactRecord(name,"legacy") as! [String:Any]
    receipt.removeValue(forKey:"accountFileTimes")
    try JSONSerialization.data(withJSONObject:receipt).write(to:url,options:.atomic)
    let fm = FileManager.default
    let practice = file(name,"practice")
    try fm.setAttributes([.modificationDate:Date()],ofItemAtPath:practice.path)
    let original = try Data(contentsOf:practice)
    let service = AccountFixtureService()
    let f = Fixture(root.appendingPathComponent(name),asset,legacyDirectory:oldDirectory(name),accounts:service)
    precondition(f.session.selectAccount("returning"))
    service.take("returning").reply(.loaded(revision:"1500",json:#"{"toneFrequency":700,"updatedAt":1500}"#))
    eventTurn()
    f.expect("pitch","700")
    f.close()
    let unchanged = try Data(contentsOf:practice)
    precondition(unchanged == original)
    print("PASS previous unstamped Exact import compares against the intact allowlisted original at timestamp 1000, regardless of its newer container file dates.")
}
try comparePreviousImportRevision()
private func earnedAccountProgress() throws {
    let dir = root.appendingPathComponent("live-account-grade")
    let service = AccountFixtureService()
    let f = Fixture(dir,asset,accounts:service,accountClock:{ 4000 })
    precondition(f.session.selectAccount("runner"))
    let first = service.take("runner")
    first.reply(.unavailable)
    eventTurn()
    f.expect("account-sync","retry")
    f.advance(30000)
    service.take("runner").reply(.loaded(revision:"v1",json:#"{"nuxCompleted":true,"scores":{"E":2},"customLetters":["E"],"updatedAt":3000}"#))
    eventTurn()
    f.expect("nux-status","skipped")
    f.set("mode","practice")
    f.expect("target","E")
    f.session.input("sequence",".")
    f.expect("history","1")
    f.advance(800)
    let save = service.take("runner","v1")
    let wire = try contents(save)
    precondition((wire["scores"] as? [String:Int])?["E"] == 3)
    precondition(wire["updatedAt"] as? Int == 4000 && wire["history"] == nil)
    precondition(f.session.selectAccount("different"))
    save.reply(.saved(revision:"v2"))
    service.take("different").reply(.loaded(revision:"empty",json:nil))
    eventTurn()
    f.expect("history","0")
    f.expect("nux-status","pending")
    f.close()
    let restart = Fixture(dir,asset,accounts:service)
    precondition(restart.session.selectAccount("runner"))
    restart.set("mode","practice")
    restart.expect("history","1")
    restart.expect("score","3")
    service.take("runner").reply(.loaded(revision:"future",json:#"{"updatedAt":1,"unknownFutureMetric":14}"#))
    eventTurn()
    restart.expect("account-sync","unavailable")
    restart.expect("score","3")
    precondition(service.requests.isEmpty && restart.timers.values.contains(where:{$0.0 == 30000}))
    restart.close()
    print("PASS graded E advances remote score 2→3 through the Apple reducer; private history survives restart, an old save callback cannot change the next learner, and an unknown old remote is protected.")
}
try earnedAccountProgress()
private func blockedAccountSwitch() throws {
    let dir = root.appendingPathComponent("blocked-account-switch")
    let service = AccountFixtureService()
    let f = Fixture(dir,asset,accounts:service)
    precondition(f.session.selectAccount("teacher"))
    service.take("teacher").reply(.loaded(revision:"t",json:#"{"nuxCompleted":true,"scores":{"E":4},"customLetters":["E"],"updatedAt":1200}"#))
    eventTurn()
    f.set("mode","practice")
    precondition(f.enabled)
    let id = SHA256.hash(data:Data("student".utf8)).map { String(format:"%02x",$0) }.joined()
    let url = dir.appendingPathComponent("dit-accounts/" + id + ".json")
    let invalid = Data(#"{"version":2}"#.utf8)
    try invalid.write(to:url,options:.withoutOverwriting)
    precondition(!f.session.selectAccount("student"))
    precondition(!f.enabled && f.values["apple-session"] == "failed",
                 "a failed account load kept the previous learner active")
    f.session.input("sequence",".")
    f.session.foreground()
    precondition(service.requests.isEmpty)
    let after = try Data(contentsOf:url)
    precondition(after == invalid)
    precondition(f.session.selectAccount(nil))
    f.expect("apple-session","ready")
    f.expect("nux-status","pending")
    precondition(f.events.contains("account-session:changed"))
    f.close()
    print("PASS an unsupported destination account suspends previous input, callbacks and private projections; sign-out restores the anonymous welcome without rewriting either learner.")
}
try blockedAccountSwitch()

private final class AuthFixtureService: AccountFixtureService, DitAccountIdentityObserver {
    var change: ((String?) -> Void)?
    var subscriptions = 0
    var cancellations = 0
    func observeIdentity(_ changed: @escaping (String?) -> Void) -> () -> Void {
        subscriptions += 1
        change = changed
        return { [weak self] in
            self?.change = nil
            self?.cancellations += 1
        }
    }
}

private func restoredAndRevokedIdentity() throws {
    let directory = root.appendingPathComponent("auth-restoration")
    let service = AuthFixtureService()
    let first = Fixture(directory,asset,accounts:service)
    first.session.bootstrap()
    first.set("mode","practice")
    first.session.input("sequence",".")
    precondition(first.events.isEmpty && !first.enabled && service.requests.isEmpty,
                 "anonymous progress or input escaped before identity restoration")
    precondition(service.subscriptions == 1)
    service.change?("restored-learner")
    eventTurn()
    service.take("restored-learner").reply(.loaded(revision:"one",json:#"{"toneFrequency":700,"updatedAt":1500}"#))
    eventTurn()
    first.expect("pitch","700")
    first.close()
    precondition(service.cancellations == 1)
    let second = Fixture(directory,asset,accounts:service)
    second.session.interrupt(true)
    second.set("mode","practice")
    precondition(!second.enabled && second.events.isEmpty)
    service.change?("restored-learner")
    eventTurn()
    second.expect("pitch","700")
    let outstanding = service.take("restored-learner")
    service.change?("restored-learner")
    eventTurn()
    precondition(service.requests.isEmpty && !second.enabled)
    let delivered = service.change
    service.change?(nil)
    eventTurn()
    second.expect("pitch","600")
    second.expect("nux-status","pending")
    outstanding.reply(.loaded(revision:"stale",json:#"{"toneFrequency":900,"updatedAt":9999}"#))
    eventTurn()
    second.expect("pitch","600")
    second.close()
    delivered?("late-learner")
    eventTurn()
    precondition(service.cancellations == 2 && service.requests.isEmpty)
    let third = Fixture(directory,asset,accounts:service)
    service.change?(nil)
    eventTurn()
    third.expect("apple-session","ready")
    third.expect("nux-status","pending")
    third.close()
    print("PASS restored identity gates startup, reloads private progress offline, ignores a revoked in-flight read, handles initial sign-out and removes its observer on close.")
}
try restoredAndRevokedIdentity()

#if DIT_FIXTURE_TEST
private func installedFixtureTransport() throws {
    let base = root.appendingPathComponent("installed-account-service")
    let run = UUID().uuidString
    let bundle = "com.tylerobinson.dit.exactspike"
    func open(_ behavior: String = "") throws -> DitFixtureAccounts {
        try DitFixtureAccounts(environment:["DIT_ACCOUNT_FIXTURE":run,"DIT_ACCOUNT_FIXTURE_READ":behavior],
                               bundle:bundle,directory:base)!
    }
    let disabled = try DitFixtureAccounts(environment:[:], bundle:bundle,directory:base)
    let unrelated = try DitFixtureAccounts(environment:["DIT_ACCOUNT_FIXTURE":run],
                                            bundle:"synthetic.unrelated",directory:base)
    precondition(disabled == nil && unrelated == nil && !FileManager.default.fileExists(atPath:base.path))
    let svc = try open()
    let first = Fixture(svc.directory,asset,accounts:svc)
    eventTurn()
    first.expect("nux-status","pending")
    svc.choose("A")
    eventTurn()
    first.expect("pitch","640")
    first.set("settings-open","true")
    first.command("pref","pitch-up")
    first.advance(800)
    eventTurn()
    first.expect("pitch","660")
    first.close()
    let retry = try open("reject-first")
    let restored = Fixture(retry.directory,asset,accounts:retry)
    eventTurn()
    restored.expect("account-sync","retry")
    restored.expect("pitch","660")
    restored.advance(30_000)
    eventTurn()
    restored.expect("account-sync","current")
    restored.close()
    let delayed = try open("hold-first")
    let switching = Fixture(delayed.directory,asset,accounts:delayed)
    eventTurn()
    switching.expect("pitch","660")
    delayed.choose("sign-out")
    delayed.choose("B")
    eventTurn()
    switching.expect("pitch","720")
    var rejected = false
    delayed.save(account:"A",replacing:"2",json:"{}") { if case .unavailable = $0 { rejected = true } }
    precondition(rejected)
    var conflict = false
    delayed.save(account:"B",replacing:"stale",json:"{}") { if case .conflict = $0 { conflict = true } }
    precondition(conflict)
    delayed.choose("sign-out")
    eventTurn()
    switching.expect("nux-status","pending")
    switching.close()
    let history = try String(contentsOf:svc.directory.appendingPathComponent("operations.txt"),encoding:.utf8)
    for event in ["saved A revision 2","rejected read A","held read A","returned A while B"] {
        precondition(history.contains(event),history)
    }
    print("PASS installed Simulator fixture service preserves earned preferences across cold restore, rejects an inactive writer, enforces revisions and delivers a late read after the account switch.")
}
try installedFixtureTransport()
private func accountDeletion(_ outcome: String) throws {
    let run = UUID().uuidString
    func open(_ outcome: String) throws -> DitFixtureAccounts {
        try DitFixtureAccounts(environment:["DIT_ACCOUNT_FIXTURE":run,"DIT_ACCOUNT_FIXTURE_DELETE":outcome],
                               bundle:"com.tylerobinson.dit.exactspike",directory:root)!
    }
    let service = try open(outcome)
    let app = Fixture(service.directory,asset,accounts:service)
    func privateFile(_ id: String) -> URL {
        service.directory.appendingPathComponent("dit-accounts/" + DitAccountFile.identifier(id) + ".json")
    }
    let db = service.directory.appendingPathComponent("synthetic-service.json")
    func records() throws -> NSDictionary {
        let database = try JSONSerialization.jsonObject(with:Data(contentsOf:db)) as! NSDictionary
        return database["records"] as! NSDictionary
    }
    let command = "delete:learner-a@example.invalid"
    var results: [String] = []
    service.deletionResult = { results.append($0) }
    eventTurn()
    service.choose("A")
    eventTurn()
    service.choose(command)
    service.choose("B")
    eventTurn()
    app.expect("pitch","720")
    precondition(results.isEmpty && service.availableLearners == "AB")
    service.choose(command)
    eventTurn()
    precondition(results.isEmpty)
    service.choose("A")
    eventTurn()
    app.expect("pitch","640")
    let before = try Data(contentsOf:db)
    let a = try Data(contentsOf:privateFile("A"))
    let b = try Data(contentsOf:privateFile("B"))
    let remoteB = try records()["B"] as! NSDictionary
    let anonymous = service.directory.appendingPathComponent("dit-practice")
    try FileManager.default.createDirectory(at:anonymous,withIntermediateDirectories:true)
    let other = anonymous.appendingPathComponent("unrelated-fixture")
    try Data("keep".utf8).write(to:other)
    let owned = anonymous.appendingPathComponent("dit.exact-spike.custom.v1")
    try Data(#"{"version":1,"source":"TEST"}"#.utf8).write(to:owned)
    service.choose(command)
    service.choose(command)
    eventTurn()
    eventTurn()
    let partialRemote = outcome == "delete-user-recent-login"
    precondition(results == [partialRemote ? "recent-login" : outcome],String(describing:results))
    if outcome != "deleted" && outcome != "cleanup" {
        app.expect("pitch","640")
        if partialRemote {
            var emptyRemote = false
            service.read(account:"A") { reply in
                if case .loaded(_,nil) = reply { emptyRemote = true }
            }
            precondition(emptyRemote)
        } else {
            precondition(try! Data(contentsOf:db) == before)
        }
        precondition(try! Data(contentsOf:privateFile("A")) == a)
        precondition(FileManager.default.fileExists(atPath:owned.path))
        precondition(service.availableLearners == "AB")
    } else {
        app.expect("nux-status","pending")
        precondition(service.availableLearners == "B")
        precondition(try! records()["A"] == nil)
        precondition(!FileManager.default.fileExists(atPath:owned.path))
        precondition(FileManager.default.fileExists(atPath:privateFile("A").path) == (outcome == "cleanup"))
        service.choose("A")
        var refused = false
        service.save(account:"A",replacing:"1",json:"{}") { if case .unavailable = $0 { refused = true } }
        precondition(refused)
    }
    precondition(try! Data(contentsOf:other) == Data("keep".utf8))
    precondition(try! Data(contentsOf:privateFile("B")) == b)
    precondition(try! records()["B"] as! NSDictionary == remoteB)
    app.close()
    if outcome == "deleted" || outcome == "cleanup" {
        // A retry after local cleanup must preserve newly earned anonymous work.
        try Data("false".utf8).write(to:anonymous.appendingPathComponent("dit.exact-spike.haptics.v1"))
        let restarted = try open("")
        let fresh = Fixture(restarted.directory,asset,accounts:restarted)
        eventTurn()
        fresh.expect("nux-status","pending")
        precondition(!fresh.hapticsEnabled)
        precondition(!FileManager.default.fileExists(atPath:privateFile("A").path))
        precondition(restarted.availableLearners == "B")
        restarted.choose("B")
        eventTurn()
        fresh.expect("pitch","720")
        fresh.close()
    }
    print("PASS synthetic account deletion " + outcome + ": identity binding, single submission, private files, service records and other learner isolation.")
}
for outcome in ["cancelled","apple-mismatch","user-mismatch","recent-login","network","failed","delete-user-recent-login","deleted","cleanup"] {
    try accountDeletion(outcome)
}
do {
    let service = try DitFixtureAccounts(environment:["DIT_ACCOUNT_FIXTURE":UUID().uuidString],
        bundle:"com.tylerobinson.dit.exactspike",directory:root)!
    let app = Fixture(service.directory,asset,accounts:service)
    eventTurn()
    service.choose("B")
    eventTurn()
    service.choose("A")
    eventTurn()
    let shared = service.directory.appendingPathComponent("dit-practice")
    try FileManager.default.createDirectory(at:shared,withIntermediateDirectories:true)
    let preference = shared.appendingPathComponent("dit.exact-spike.haptics.v1")
    try Data("false".utf8).write(to:preference)
    service.choose("delete:learner-a@example.invalid")
    eventTurn()
    eventTurn()
    precondition(service.availableLearners == "B")
    precondition(try! Data(contentsOf:preference) == Data("false".utf8))
    let owner = service.directory.appendingPathComponent("dit-accounts/anonymous-owner")
    precondition(try! Data(contentsOf:owner) == Data(DitAccountFile.identifier("B").utf8))
    app.close()
    print("PASS deleting the second learner preserves the first learner's anonymous progress and ownership.")
}
#endif
