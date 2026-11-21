// Synthetic app-private file fixture. Never uses an installed app's data container.
do {
    let directory = root.appendingPathComponent("confirmed-local-reset")
    let store = directory.appendingPathComponent("dit-practice")
    let legacy = directory.appendingPathComponent("fixture-legacy")
    try FileManager.default.createDirectory(at: store, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: legacy, withIntermediateDirectories: true)
    let manifest = #"{"dit-nux-status":"completed","dit-progress":"{\"scores\":{\"E\":9},\"maxLevel\":2}"}"#
    try manifest.write(to: legacy.appendingPathComponent("manifest.json"), atomically: true, encoding: .utf8)
    let data: [String:String] = [
        "onboarding": #"{"version":1,"status":"completed","profile":"known","step":"welcome"}"#,
        "practice": #"{"version":1,"settings":{"pitch":540},"scores":{"A":8},"history":[],"bestWpm":12}"#,
        "legacy": #"{"version":1,"preserved":{"bestWpm":12}}"#,
        "custom": #"{"version":1,"source":"ET E","typeAlong":true}"#, "haptics":"false",
    ]
    func file(_ name:String) -> URL { store.appendingPathComponent("dit.exact-spike."+name+".v1") }
    for (key,value) in data { try value.write(to:file(key), atomically:true, encoding:.utf8) }
    let unrelated = store.appendingPathComponent("fixture-other")
    try "untouched".write(to:unrelated,atomically:true,encoding:.utf8)
    let app = Fixture(directory,asset,legacyDirectory:legacy)
    app.set("mode","practice")
    app.command("pref","reset-local-app")
    app.expect("nux-status","completed")
    precondition(try! String(contentsOf:file("practice"), encoding:.utf8)==data["practice"])
    app.set("blocked","true")
    app.set("settings-open","true")
    app.command("pref","reset-local-app")
    app.expect("local-reset","complete")
    app.expect("nux-step","welcome")
    app.expect("nux-status","pending")
    precondition(app.hapticsEnabled && app.center.requests == 0)
    app.close()
    for key in data.keys where key != "onboarding" { precondition(!FileManager.default.fileExists(atPath:file(key).path)) }
    precondition(try! String(contentsOf:unrelated,encoding:.utf8) == "untouched")
    precondition(try! String(contentsOf:legacy.appendingPathComponent("manifest.json"),encoding:.utf8) == manifest)
    let again = Fixture(directory,asset,legacyDirectory:legacy)
    again.expect("nux-status","pending")
    again.expect("score","0")
    again.close()
    print("PASS confirmed signed-out Reset App: Settings guard, private progress and passage removal, Welcome and haptics restored, no permission request; unrelated file and original legacy manifest survive, restart does not re-import.")
}

do {
    let dir = root.appendingPathComponent("interrupted-reset")
    let store = dir.appendingPathComponent("dit-practice")
    try FileManager.default.createDirectory(at:store,withIntermediateDirectories:true)
    func write(_ name:String,_ text:String) throws {
        try text.write(to:store.appendingPathComponent(name),atomically:true,encoding:.utf8)
    }
    try write("dit.exact-spike.reset-pending.v1","")
    try write("dit.exact-spike.custom.v1","remaining fixture copy")
    try write("dit.exact-spike.haptics.v1","false")
    try write("fixture-other","keep")
    let recovered = Fixture(dir,asset)
    recovered.expect("nux-status","pending")
    precondition(recovered.hapticsEnabled && recovered.center.requests == 0)
    let files = try FileManager.default.contentsOfDirectory(atPath:store.path)
    precondition(!files.contains("dit.exact-spike.reset-pending.v1") && !files.contains("dit.exact-spike.custom.v1"))
    precondition(files.contains("fixture-other"))
    recovered.close()
    print("PASS interrupted reset finishes at startup, before onboarding or progress hydration.")
}

do {
    let dir = root.appendingPathComponent("refused-reset")
    let store = dir.appendingPathComponent("dit-practice")
    let blocker = store.appendingPathComponent("dit.exact-spike.custom.v1")
    try FileManager.default.createDirectory(at:blocker,withIntermediateDirectories:true)
    let secret = blocker.appendingPathComponent("synthetic-unrelated")
    try "keep".write(to:secret,atomically:true,encoding:.utf8)
    let progress = store.appendingPathComponent("dit.exact-spike.practice.v1")
    let baseline = #"{"version":1,"settings":{},"scores":{"A":7},"history":[]}"#
    try baseline.write(to:progress,atomically:true,encoding:.utf8)
    let app = Fixture(dir,asset)
    app.set("mode","practice");app.set("blocked","true");app.set("settings-open","true")
    app.command("pref","reset-local-app")
    app.expect("local-reset","error")
    precondition(try! String(contentsOf:progress,encoding:.utf8) == baseline)
    precondition(try! String(contentsOf:secret,encoding:.utf8) == "keep")
    app.close()
    print("PASS unexpected directory in a record slot refuses the reset before changing scores or its contents.")
}
