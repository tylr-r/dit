#if DIT_FIXTURE_TEST
private func signedInReset(_ mode: String) throws {
    let run = UUID().uuidString
    func open() throws -> DitFixtureAccounts {
        try DitFixtureAccounts(environment:["DIT_ACCOUNT_FIXTURE":run,"DIT_ACCOUNT_FIXTURE_RESET":mode],
                               bundle:"com.tylerobinson.dit.exactspike",directory:root)!
    }
    let service = try open()
    let app = Fixture(service.directory,asset,accounts:service)
    let database = service.directory.appendingPathComponent("synthetic-service.json")
    func state() throws -> NSDictionary {
        try JSONSerialization.jsonObject(with:Data(contentsOf:database)) as! NSDictionary
    }
    func record(_ id: String) throws -> NSDictionary {
        (try state()["records"] as! NSDictionary)[id] as! NSDictionary
    }
    func snapshot(_ id: String) -> URL {
        service.directory.appendingPathComponent("dit-accounts/" + DitAccountFile.identifier(id) + ".json")
    }

    eventTurn()
    service.choose("B")
    eventTurn()
    app.expect("pitch","720")
    service.choose("A")
    eventTurn()
    app.expect("pitch","640")
    let saved = #"{"learnerProfile":"known","nuxCompleted":true,"toneFrequency":640,"scores":{"E":4},"customLetters":["E"],"updatedAt":2000}"#
    service.save(account:"A",replacing:"1",json:saved) { reply in
        guard case .saved("2") = reply else { preconditionFailure("could not seed earned progress") }
    }
    service.choose("B")
    service.choose("A")
    eventTurn()
    app.set("mode","practice")
    app.expect("score","4")
    let device = service.directory.appendingPathComponent("dit-practice")
    try FileManager.default.createDirectory(at:device,withIntermediateDirectories:true)
    let sentinel = device.appendingPathComponent("unrelated")
    try Data("keep".utf8).write(to:sentinel)
    let known = device.appendingPathComponent("dit.exact-spike.custom.v1")
    if mode == "local-error" {
        try FileManager.default.createDirectory(at:known,withIntermediateDirectories:true)
    } else {
        try Data(#"{"version":1,"source":"fixture"}"#.utf8).write(to:known)
    }
    let a = try Data(contentsOf:snapshot("A"))
    let b = try Data(contentsOf:snapshot("B"))
    let remoteA = try record("A")
    let remoteB = try record("B")
    let email = "learner-a@example.invalid"
    let check = "reset-check:" + email
    let commit = (mode == "offline" ? "reset-device:" : "reset-online:") + email
    var messages: [String] = []
    service.resetMessage = { messages.append($0) }
    let baseline = try Data(contentsOf:database)
    service.choose(commit)
    service.choose("reset-check:learner-b@example.invalid")
    precondition(messages.isEmpty)
    service.choose(check)
    precondition(messages == ["account-reset:" + (mode == "offline" ? "offline:" : "online:") + email])
    service.choose((mode == "offline" ? "reset-online:" : "reset-device:") + email)
    precondition(try! Data(contentsOf:database) == baseline)
    precondition(try! Data(contentsOf:snapshot("A")) == a)
    service.choose("B")
    service.choose("A")
    eventTurn()
    service.choose(commit)
    precondition(try! state()["selected"] as? String == "A")
    precondition(try! record("A") == remoteA)
    service.choose(check)
    service.choose(commit)
    service.choose(commit)
    eventTurn()
    precondition(try! Data(contentsOf:sentinel) == Data("keep".utf8))
    precondition(try! Data(contentsOf:snapshot("B")) == b)
    precondition(try! record("B") == remoteB)
    precondition(service.availableLearners == "AB")
    if mode == "local-error" {
        precondition(messages.last == "local-reset:error")
        precondition(try! state()["selected"] as? String == "A")
        precondition(try! record("A") == remoteA)
        precondition(try! Data(contentsOf:snapshot("A")) == a)
        app.close()
        let reopened = try open()
        let restored = Fixture(reopened.directory,asset,accounts:reopened)
        eventTurn()
        restored.expect("pitch","640")
        precondition(try! record("A") == remoteA)
        restored.close()
    } else {
        precondition(try! state()["selected"] == nil)
        precondition(!FileManager.default.fileExists(atPath:known.path))
        let blank = try JSONSerialization.jsonObject(with:Data(contentsOf:snapshot("A"))) as! NSDictionary
        precondition((blank["records"] as! NSDictionary).count == 0 && blank["dirty"] as? Bool == false)
        if mode == "online" {
            precondition(try! record("A")["body"] == nil)
            precondition(try! record("A")["revision"] as? Int == 3)
        } else {
            precondition(try! record("A") == remoteA)
        }
        app.expect("nux-status","pending")
        app.expect("pitch","600")
        app.close()
        let reopened = try open()
        let restored = Fixture(reopened.directory,asset,accounts:reopened)
        eventTurn()
        restored.expect("nux-status","pending")
        reopened.choose("A")
        eventTurn()
        restored.expect("pitch", mode == "online" ? "600" : "640")
        restored.expect("nux-status", mode == "online" ? "pending" : "skipped")
        restored.set("mode","practice")
        restored.expect("score", mode == "online" ? "0" : "4")
        reopened.choose("B")
        eventTurn()
        restored.expect("pitch","720")
        restored.close()
    }
    print("PASS signed-in reset " + mode + ": consent, stale identity, device/private files, remote record, both learners and cold restore.")
}
for mode in ["offline","online","remote-error","local-error"] {
    try signedInReset(mode)
}
// Simulate process termination after journaling device cleanup, before acknowledgement.
do {
    let env = ["DIT_ACCOUNT_FIXTURE":UUID().uuidString]
    let bundle = "com.tylerobinson.dit.exactspike"
    let service = try DitFixtureAccounts(environment:env,bundle:bundle,directory:root)!
    let app = Fixture(service.directory,asset,accounts:service)
    eventTurn()
    service.choose("A")
    eventTurn()
    app.expect("pitch","640")
    app.close()
    let db = service.directory.appendingPathComponent("synthetic-service.json")
    var stored = try JSONSerialization.jsonObject(with:Data(contentsOf:db)) as! [String:Any]
    let records = stored["records"] as! NSDictionary
    stored["pendingReset"] = "A"
    try JSONSerialization.data(withJSONObject:stored).write(to:db,options:.atomic)
    let cold = try DitFixtureAccounts(environment:env,bundle:bundle,directory:root)!
    let fresh = Fixture(cold.directory,asset,accounts:cold)
    eventTurn()
    fresh.expect("nux-status","pending")
    let after = try JSONSerialization.jsonObject(with:Data(contentsOf:db)) as! NSDictionary
    precondition(after["pendingReset"] == nil && after["selected"] == nil)
    precondition(after["records"] as! NSDictionary == records)
    cold.choose("A")
    eventTurn()
    fresh.expect("pitch","640")
    fresh.close()
    print("PASS interrupted reset recovers to signed-out Welcome and preserves synced progress without issuing a deferred cloud clear.")
}
#endif
