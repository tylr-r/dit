// Exercise the same path adapter as the isolated app with no SDK and no network.
private final class RecordingProgressDatabase: DitProgressDatabaseClient {
    struct Read {
        let path: String
        let finish: (DitProgressNode) -> Void
    }
    struct Write {
        let path: String
        let revision: String
        let value: [String:Any]
        let finish: (DitProgressWrite) -> Void
    }
    var authenticatedUID: String?
    var progressIdentity: (account: String, uid: String)? { authenticatedUID.map { ($0,$0) } }
    var changed: ((String?) -> Void)?
    var reads: [Read] = []
    var writes: [Write] = []

    func observeIdentity(_ listener: @escaping (String?) -> Void) -> () -> Void {
        changed = listener
        listener(authenticatedUID)
        return { [weak self] in self?.changed = nil }
    }
    func select(_ uid: String?) {
        authenticatedUID = uid
        changed?(uid)
        eventTurn()
    }
    func readNode(at path: String, done: @escaping (DitProgressNode) -> Void) {
        reads.append(Read(path:path,finish:done))
    }
    func replaceNode(at path: String, matching revision: String, value: [String:Any], done: @escaping (DitProgressWrite) -> Void) {
        writes.append(Write(path:path,revision:revision,value:value,finish:done))
    }
}

private func checkProgressDatabase() throws {
    let oracleURL = URL(fileURLWithPath:CommandLine.arguments[2])
    let oracle = try JSONSerialization.jsonObject(with:Data(contentsOf:oracleURL)) as! [[String:Any]]
    let a = "synthetic-A", b = "synthetic-B"
    let pathA = oracle[0]["path"] as! String, pathB = oracle[2]["path"] as! String
    precondition(pathA == "users/synthetic-A/progress" && pathB == "users/synthetic-B/progress")
    let name = "progress-wire-boundary"
    let directory = root.appendingPathComponent(name), legacy = oldDirectory(name)
    try FileManager.default.createDirectory(at:legacy,withIntermediateDirectories:true)
    let manifest = ["dit-progress":#"{"updatedAt":1000,"scores":{"E":4},"hapticsEnabled":false,"bestWpm":0}"#]
    try JSONSerialization.data(withJSONObject:manifest).write(to:legacy.appendingPathComponent("manifest.json"))
    let db = RecordingProgressDatabase()
    let f = Fixture(directory,asset,legacyDirectory:legacy,accounts:db)
    eventTurn()
    try seed(name,"custom","PRIVATE SYNTHETIC COPY")
    precondition(db.reads.isEmpty && db.writes.isEmpty)
    db.select(a)
    precondition(db.reads.count == 1 && db.reads[0].path == pathA)
    db.reads[0].finish(.snapshot(revision:"A1",value:["toneFrequency":720,"updatedAt":500]))
    eventTurn(); f.expect("pitch","600"); f.advance(800)
    let save = db.writes[0]
    precondition(save.path == oracle[1]["path"] as? String && save.revision == "A1")
    precondition((oracle[1]["value"] as! NSDictionary).isEqual(to:save.value), "wire snapshot differs from shipped fixture")
    save.finish(.saved(revision:"A2")); eventTurn(); f.expect("account-sync","current")

    func fileBytes(_ uid: String) throws -> Data {
        try Data(contentsOf:directory.appendingPathComponent("dit-accounts/" + DitAccountFile.identifier(uid) + ".json"))
    }
    let storedA = try fileBytes(a)
    f.session.foreground()
    precondition(db.reads.count == 2 && db.reads[1].path == pathA)
    db.select(b)
    precondition(db.reads.count == 3 && db.reads[2].path == pathB)
    db.reads[2].finish(.snapshot(revision:"B1",value:["toneFrequency":740,"scores":["T":7],"updatedAt":2000]))
    eventTurn(); f.expect("pitch","740")
    let storedB = try fileBytes(b)
    let envelope = try JSONSerialization.jsonObject(with:storedB) as! [String:Any]
    let records = envelope["records"] as! [String:String]
    let practice = try JSONSerialization.jsonObject(with:Data(records["dit.exact-spike.practice.v1"]!.utf8)) as! [String:Any]
    precondition(practice["scores"] as? [String:Int] == ["T":7] && records["dit.exact-spike.custom.v1"] == nil)
    db.reads[1].finish(.snapshot(revision:"late-A",value:["toneFrequency":400,"scores":["E":99],"updatedAt":9000]))
    eventTurn(); f.expect("pitch","740")
    precondition(try! fileBytes(b) == storedB)
    f.session.foreground()
    precondition(db.reads.count == 4 && db.reads[3].path == pathB)
    db.select(nil)
    let anonymousPitch = f.values["pitch"]
    db.reads[3].finish(.snapshot(revision:"late-B",value:["toneFrequency":800,"updatedAt":9999]))
    eventTurn()
    precondition(f.values["pitch"] == anonymousPitch && db.writes.count == 1)
    precondition(try! fileBytes(a) == storedA && fileBytes(b) == storedB)
    f.close()
    let cold = Fixture(directory,asset,accounts:db)
    eventTurn(); db.select(b); cold.expect("pitch","740")
    db.select(a); cold.expect("pitch","600"); cold.close()
    precondition(db.changed == nil)

    // Invalid path components and an identity mismatch must never reach the client.
    let readCount = db.reads.count
    for id in [b,"bad/child","bad.key","bad#key","bad$key","bad[key]","","bad\u{7f}key"] {
        db.authenticatedUID = id == b ? a : id
        db.read(account:id) { guard case .unavailable = $0 else { preconditionFailure() } }
        db.save(account:id,replacing:"r1",json:"{}") { guard case .unavailable = $0 else { preconditionFailure() } }
    }
    precondition(db.reads.count == readCount && db.writes.count == 1)
    print("PASS progress database: pinned per-user paths and full save payload, timestamp 1000 wins over 500, B restores, late A after switch and late B after sign-out leave both files unchanged, cold restore and invalid paths.")
}
try checkProgressDatabase()
