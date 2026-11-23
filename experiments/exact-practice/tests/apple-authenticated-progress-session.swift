// Integration fixture for DitAuthenticatedProgressDatabase → JSCore → private files.
// Only this last HTTP send is replaced. The sender has no network implementation.
private final class HeldProgressHTTP {
    typealias Reply = (Data, URLResponse)
    struct Pending {
        let request: URLRequest
        let continuation: CheckedContinuation<Reply, Error>
        func ok(_ revision: String, _ json: String) {
            let response = HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:"HTTP/1.1",headerFields:["ETag":revision])!
            continuation.resume(returning:(Data(json.utf8),response))
        }
    }
    var waiting = [Pending]()
    var returned = 0
    @MainActor func send(_ request: URLRequest) async throws -> Reply {
        defer { returned += 1 }
        return try await withCheckedThrowingContinuation { waiting.append(Pending(request:request,continuation:$0)) }
    }
    func take(_ method: String, _ uid: String, token: String? = nil) -> Pending {
        until { !self.waiting.isEmpty }
        let pending = waiting.removeFirst(), req = pending.request
        let url = URLComponents(url:req.url!,resolvingAgainstBaseURL:false)!
        precondition(req.httpMethod == method && url.scheme == "https" && url.host == "demo-dit-parity-default-rtdb.firebaseio.com")
        precondition(url.path == "/users/" + uid + "/progress.json")
        precondition(url.queryItems == [URLQueryItem(name:"auth",value:token ?? ("fixture-" + uid))])
        precondition(req.value(forHTTPHeaderField:"X-Firebase-ETag") == "true")
        return pending
    }
}

private func authenticatedSessionAcceptance(directory: URL, asset: URL, cold: Bool) throws {
    let a = SyntheticUser("synthetic-A"), b = SyntheticUser("synthetic-B")
    let owner = SyntheticOwner(), http = HeldProgressHTTP()
    owner.currentProgressUser = cold ? b : a
    let db = DitAuthenticatedProgressDatabase(owner:owner,send:http.send)!
    let f = Fixture(directory,asset,accounts:db,accountClock:{ 4000 })
    func file(_ user: SyntheticUser) throws -> Data {
        try Data(contentsOf:directory.appendingPathComponent("dit-accounts/" + DitAccountFile.identifier(user.uid) + ".json"))
    }
    func checkB() {
        f.expect("target","T"); f.expect("score","7"); f.expect("pitch","740"); f.expect("history","1")
    }
    if cold {
        // Hold B's refresh through bootstrap and check the projection before returning any data.
        let refresh = http.take("GET",b.uid)
        f.set("mode","practice"); checkB()
        refresh.continuation.resume(throwing:URLError(.notConnectedToInternet))
        until { f.values["account-sync"] == "retry" }
        checkB()
        precondition(http.returned == 1 && http.waiting.isEmpty)
        f.close()
        print("PASS fresh-process JSCore restore: synthetic B at 740 Hz, T score 7 and one local attempt before refresh and after an offline error.")
        return
    }
    let first = http.take("GET",a.uid)
    first.ok("A1",#"{"updatedAt":1000,"toneFrequency":640,"nuxCompleted":true,"customLetters":["E"],"scores":{"E":4}}"#)
    until { f.values["account-sync"] == "current" }
    f.set("mode","practice"); f.expect("pitch","640"); f.expect("target","E"); f.expect("score","4")
    let originalA = try file(a)
    f.session.foreground()
    let delayed = http.take("GET",a.uid)
    owner.currentProgressUser = b
    let next = http.take("GET",b.uid)
    next.ok("B1",#"{"updatedAt":2000,"toneFrequency":720,"nuxCompleted":true,"customLetters":["T"],"scores":{"T":6}}"#)
    until { f.values["account-sync"] == "current" && f.values["pitch"] == "720" }
    f.expect("target","T"); f.expect("score","6")
    f.command("pref","pitch-up"); f.session.input("sequence","-"); checkB()
    f.advance(800)
    let put = http.take("PUT",b.uid)
    precondition(put.request.value(forHTTPHeaderField:"If-Match") == "B1")
    let payload = try JSONSerialization.jsonObject(with:put.request.httpBody!) as! [String:Any]
    let scores = payload["scores"] as! [String:Int]
    precondition(payload["toneFrequency"] as? Int == 740 && scores["T"] == 7 && scores["E"] == 0)
    precondition(payload["history"] == nil)
    put.ok("B2","{}")
    until { f.values["account-sync"] == "current" }
    let savedB = try file(b)
    precondition(savedB != originalA)
    let envelope = try JSONSerialization.jsonObject(with:savedB) as! [String:Any]
    let records = envelope["records"] as! [String:String]
    let practice = try JSONSerialization.jsonObject(with:Data(records["dit.exact-spike.practice.v1"]!.utf8)) as! [String:Any]
    precondition(envelope["dirty"] as? Bool == false && practice["scores"] as? [String:Int] == ["T":7])
    let eventsAtSwitch = f.events.count
    delayed.ok("A-late",#"{"updatedAt":99000,"toneFrequency":400,"nuxCompleted":true,"customLetters":["E"],"scores":{"E":99}}"#)
    until { http.returned == 4 }
    eventTurn()
    checkB(); f.expect("account-sync","current")
    precondition(f.events.count == eventsAtSwitch && http.waiting.isEmpty)
    precondition(try! file(a) == originalA && file(b) == savedB)
    f.close()
    print("PASS composed authenticated Swift HTTP + JSCore: held A response after B's conditional save, no late projection or write, distinct account files byte-identical.")
}

/// Suspends ID-token acquisition, before the authenticated client has made a request.
private final class HeldIDToken {
    var continuation: CheckedContinuation<String,Never>?
    var delivered = false
    @MainActor func fetch() async -> String {
        let token = await withCheckedContinuation { continuation = $0 }
        delivered = true
        return token
    }
    func finish() {
        precondition(continuation != nil)
        continuation?.resume(returning:"synthetic-late-A")
        continuation = nil
        until { self.delivered }
        eventTurn()
    }
}

private func progressIdentityAcceptance(directory: URL, asset: URL) throws {
    var publish: ((DitProgressUser?) -> Void)?
    var stops = 0
    let owner = DitProgressIdentitySession(databaseRoot:URL(string:"https://demo-dit-parity-default-rtdb.firebaseio.com")!) { receive in
        publish = receive
        return { stops += 1 }
    }
    let http = HeldProgressHTTP()
    let client = DitAuthenticatedProgressDatabase(owner:owner,send:http.send)!
    let f = Fixture(directory,asset,accounts:client,accountClock:{ 4000 })
    let a = SyntheticUser("synthetic-A"), refreshedA = SyntheticUser(a.uid), b = SyntheticUser("synthetic-B")
    refreshedA.token = { "synthetic-A-v2" }
    func file(_ uid: String) throws -> Data {
        try Data(contentsOf:directory.appendingPathComponent("dit-accounts/" + DitAccountFile.identifier(uid) + ".json"))
    }
    precondition(publish != nil && f.events.isEmpty && http.waiting.isEmpty)
    publish?(nil)
    until { f.values["pitch"] != nil }
    f.set("mode","practice")
    let guestPitch = f.values["pitch"], guestScore = f.values["score"]
    publish?(a)
    let initial = http.take("GET",a.uid)
    initial.ok("A1",#"{"updatedAt":1000,"toneFrequency":640,"nuxCompleted":true,"customLetters":["E"],"scores":{"E":4}}"#)
    until { f.values["account-sync"] == "current" }
    f.expect("target","E"); f.expect("score","4"); f.expect("pitch","640")
    f.command("pref","pitch-up"); f.session.input("sequence",".")
    f.expect("score","5"); f.expect("pitch","660"); f.expect("history","1")
    let login = owner.currentProgressUser, dirtyA = try file(a.uid)
    let duringSave = HeldIDToken()
    a.token = { await duringSave.fetch() }
    f.advance(800)
    until { duringSave.continuation != nil }
    let beforeRefresh = f.events.count
    var selected: [String?] = []
    let stopSecondObserver = owner.observeIdentity { selected.append($0) }
    publish?(refreshedA); eventTurn()
    precondition(owner.currentProgressUser === login && selected == [a.uid])
    precondition(f.events.count == beforeRefresh && http.waiting.isEmpty)
    precondition(try! file(a.uid) == dirtyA)
    duringSave.finish()
    f.expect("account-sync","saving")
    let put = http.take("PUT",a.uid,token:"synthetic-A-v2")
    precondition(put.request.value(forHTTPHeaderField:"If-Match") == "A1")
    let payload = try JSONSerialization.jsonObject(with:put.request.httpBody!) as! [String:Any]
    precondition(payload["toneFrequency"] as? Int == 660 && (payload["scores"] as? [String:Int])?["E"] == 5)
    put.ok("A2","{}"); until { f.values["account-sync"] == "current" }
    let savedA = try file(a.uid)
    f.expect("score","5"); f.expect("pitch","660"); f.expect("history","1")
    print("PASS same-user token refresh: one A selection, dirty file and visible state preserved, conditional save of 660 Hz and E=5 used refreshed token.")

    let onSignOut = HeldIDToken()
    refreshedA.token = { await onSignOut.fetch() }
    f.session.foreground()
    until { onSignOut.continuation != nil }
    publish?(nil)
    until { owner.currentProgressUser == nil && f.values["pitch"] == guestPitch }
    let guestEvents = f.events.count
    onSignOut.finish()
    precondition(owner.currentProgressUser == nil && selected == [a.uid,nil])
    precondition(f.events.count == guestEvents && f.values["score"] == guestScore && http.waiting.isEmpty)
    precondition(try! file(a.uid) == savedA)
    print("PASS late A token after sign-out: guest remained visible, zero HTTP requests or identity changes, A file unchanged.")

    // The same provider user object may be supplied again on a new sign-in.
    refreshedA.token = { "synthetic-A-v3" }
    publish?(refreshedA)
    precondition(owner.currentProgressUser !== login)
    let restore = http.take("GET",a.uid,token:"synthetic-A-v3")
    f.expect("score","5"); f.expect("pitch","660"); f.expect("history","1")
    restore.continuation.resume(throwing:URLError(.notConnectedToInternet))
    until { f.values["account-sync"] == "retry" }
    let onSwitch = HeldIDToken()
    refreshedA.token = { await onSwitch.fetch() }
    f.advance(30000)
    until { onSwitch.continuation != nil }
    publish?(b)
    let other = http.take("GET",b.uid)
    other.ok("B1",#"{"updatedAt":2000,"toneFrequency":740,"nuxCompleted":true,"customLetters":["T"],"scores":{"T":7}}"#)
    until { f.values["pitch"] == "740" && f.values["account-sync"] == "current" }
    let savedB = try file(b.uid), eventsB = f.events.count
    onSwitch.finish()
    precondition(selected == [a.uid,nil,a.uid,b.uid] && owner.currentProgressUser?.uid == b.uid)
    precondition(f.events.count == eventsB && http.waiting.isEmpty)
    precondition(try! file(a.uid) == savedA && file(b.uid) == savedB && savedA != savedB)
    f.expect("target","T"); f.expect("score","7"); f.expect("pitch","740")
    print("PASS late A token after switch to B: zero stale HTTP requests or projections, B retained 740 Hz and T=7, both private files unchanged.")

    stopSecondObserver(); precondition(stops == 0)
    f.close(); precondition(stops == 1 && owner.currentProgressUser == nil)
    publish?(a)
    precondition(owner.currentProgressUser == nil && http.waiting.isEmpty)
}
