// Offline upgrade fixture. Every path is under the temporary session test root.
private let legacyHash = "cde3bbfdca9b4deab8b66860ddc6460e"
private func oldDirectory(_ name: String) -> URL {
    root.appendingPathComponent(name + "-container/Library/Application Support/com.tylerobinson.dit/RCTAsyncLocalStorage_V1")
}
private func legacyLaunch(_ name: String) -> Fixture {
    Fixture(root.appendingPathComponent(name), asset, legacyDirectory: oldDirectory(name))
}
private func legacyPayload() -> [String: Any] {
    let letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".map { String($0) }
    return ["updatedAt":1000, "scores":Dictionary(uniqueKeysWithValues:letters.map { ($0, $0 == "I" ? 9 : 0) }),
            "learnerProfile":"beginner", "guidedCourseActive":true, "guidedPackIndex":2,
            "guidedMaxPackReached":4, "guidedPhase":"practice",
            "guidedProgress":["teachCounts":["I":2,"M":2], "practiceAttempts":5, "practiceCorrect":3,
                              "practiceLetterCorrect":["I":2,"M":1], "listenAttempts":0,"listenCorrect":0,
                              "listenLetterCorrect":[String:Int]()] as [String:Any],
            "dailyActivity":["2026-11-18":["correct":16, "modes":["practice","listen"]] as [String:Any]],
            "streak":["current":3,"longest":8,"lastCountedDate":"2026-11-18"] as [String:Any],
            "letterAccuracy":["I":["recent":[true,false,true]]], "listenTtr":["I":["averageMs":731,"samples":3]],
            "toneFrequency":640,"listenWpm":18,"listenEffectiveWpm":12,"listenAutoTightening":false,
            "maxLevel":2,"customLetters":["M","I"],"practiceLearnMode":false,"practiceIfrMode":true,
            "practiceReviewMisses":true,"wordMode":false,"hapticsEnabled":false,
            "reminder":["enabled":false,"time":"18:20"] as [String:Any],
            "bestWpm":22,"showHint":true,"showMnemonic":false,"practiceAutoPlay":true,"practiceWordMode":false,
            "nuxCompleted":true]
}
private func seedLegacy(_ name: String) throws -> (Data,Data) {
    let dir = oldDirectory(name)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let blob = try JSONSerialization.data(withJSONObject: legacyPayload(),options:[.sortedKeys])
    precondition(blob.count > 1024)
    let manifest = try JSONSerialization.data(withJSONObject: ["dit-nux-status":"completed","dit-progress":NSNull(),
        "unrelated-fixture-key":NSNull()] as [String:Any],options:[.sortedKeys])
    try manifest.write(to: dir.appendingPathComponent("manifest.json"))
    try blob.write(to: dir.appendingPathComponent(legacyHash))
    return (manifest,blob)
}
private func checkLegacyOfflineLaunch() throws {
    let name = "legacy-offline"
    let (manifest,blob) = try seedLegacy(name)
    let first = legacyLaunch(name)
    first.expect("nux-status","completed")
    first.expect("nux-enter","guided")
    first.set("mode","guided")
    first.expect("guide-pack","I,M")
    first.expect("guide-phase","practice")
    precondition(!first.hapticsEnabled)
    first.close()
    let again = legacyLaunch(name)
    again.expect("nux-status","completed")
    again.expect("nux-enter","guided")
    again.close()
    let dir = oldDirectory(name)
    let remainingManifest = try Data(contentsOf:dir.appendingPathComponent("manifest.json"))
    let remainingProgress = try Data(contentsOf:dir.appendingPathComponent(legacyHash))
    precondition(manifest == remainingManifest && blob == remainingProgress)
}
try checkLegacyOfflineLaunch()

private func exactRecord(_ name: String, _ key: String) throws -> NSDictionary {
    try JSONSerialization.jsonObject(with: Data(contentsOf:file(name,key))) as! NSDictionary
}
private func held(_ name: String) {
    let f = Fixture(root.appendingPathComponent(name),asset,legacyDirectory:oldDirectory(name),expectFailure:true)
    precondition(f.migrationHeld && f.events.isEmpty && f.tones.isEmpty && f.center.requests == 0)
    precondition(!FileManager.default.fileExists(atPath:file(name,"practice").deletingLastPathComponent().path))
}
private func checkMigratedValues() throws {
    let name = "legacy-offline"
    let p = try exactRecord(name,"practice")
    let original = legacyPayload() as NSDictionary
    for key in ["streak","dailyActivity","scores","letterAccuracy","listenTtr"] {
        precondition((p[key] as? NSDictionary)?.isEqual(original[key]) == true, key + " changed")
    }
    precondition((p["history"] as? NSArray)?.count == 0)
    let g = try exactRecord(name,"guided")["data"] as! NSDictionary
    precondition(g["pack"] as? Int == 2 && g["maxPackReached"] as? Int == 4)
    precondition((g["progress"] as! NSDictionary).isEqual(original["guidedProgress"]))
    let receipt = try exactRecord(name,"legacy")
    precondition(receipt["sourceUpdatedAt"] as? Int == 1000)
    precondition((receipt["preserved"] as! NSDictionary)["bestWpm"] as? Int == 22)
    let settings = p["settings"] as! NSDictionary
    precondition((settings["selection"] as! NSDictionary)["letters"] as! [String] == ["M","I"])
    precondition(settings["speed"] as? Int == 18 && settings["effectiveSpeed"] as? Int == 12 &&
                 settings["pitch"] as? Int == 640 && settings["strategy"] as? String == "weighted")
    let reminder = try exactRecord(name,"reminder")
    precondition(reminder["time"] as? String == "18:20" && reminder["enabled"] as? Bool == false)
    print("PASS offline first launch and restart: completed setup, I/M Practice at pack index 2, high-water 4, full counters, 3/8 streak, activity, scores, accuracy, TTR, haptics off and source timestamp 1000. Original manifest and MD5 blob byte-identical.")
}

private func checkLegacyFailures() throws {
    let fm = FileManager.default
    let name = "partial-legacy"
    let (_, good) = try seedLegacy(name)
    let source = oldDirectory(name).appendingPathComponent(legacyHash)
    try fm.removeItem(at:source)
    held(name)
    try Data("{".utf8).write(to:source)
    held(name)
    var future = legacyPayload()
    future["unrecognizedSyntheticField"] = 1
    try JSONSerialization.data(withJSONObject:future).write(to:source)
    held(name)
    let sentinel = root.appendingPathComponent("synthetic-symlink-target")
    try good.write(to:sentinel)
    try fm.removeItem(at:source)
    try fm.createSymbolicLink(at:source,withDestinationURL:sentinel)
    held(name)
    try fm.removeItem(at:source)
    try good.write(to:source)
    let manifestURL = oldDirectory(name).appendingPathComponent("manifest.json")
    let manifest = try Data(contentsOf:manifestURL)
    try fm.removeItem(at:manifestURL)
    held(name)
    try Data("{".utf8).write(to:manifestURL)
    held(name)
    try manifest.write(to:manifestURL)
    let repaired = legacyLaunch(name)
    repaired.expect("nux-status","completed")
    repaired.expect("nux-enter","guided")
    repaired.close()
    let untouched = try Data(contentsOf:sentinel)
    precondition(untouched == good)
    print("PASS missing, malformed, unknown-format and symlinked progress; orphaned or malformed manifest: no Exact store, no bootstrap or permission action. Repair and retry succeeds.")
}

private func checkLegacyPrecedence() throws {
    let fm = FileManager.default
    let newer = "newer-exact"
    let _ = try seedLegacy(newer)
    try seed(newer,"onboarding",#"{"version":1,"status":"skipped","step":"welcome","profile":"known","soundComplete":true,"taps":3,"holds":3}"#)
    try seed(newer,"practice",#"{"version":1,"settings":{},"scores":{"I":27},"history":[]}"#)
    try seed(newer,"legacy",#"{"version":1,"sourceUpdatedAt":2000,"preserved":{}}"#)
    let validOlder = legacyLaunch(newer)
    validOlder.expect("nux-status","skipped")
    validOlder.expect("score","27")
    validOlder.close()
    // Exact must take precedence before opening even the legacy manifest.
    try Data("{".utf8).write(to:oldDirectory(newer).appendingPathComponent("manifest.json"))
    let again = legacyLaunch(newer)
    again.expect("nux-status","skipped")
    again.expect("score","27")
    again.close()
    let winner = try exactRecord(newer,"legacy")
    precondition(winner["sourceUpdatedAt"] as? Int == 2000 && !fm.fileExists(atPath:file(newer,"guided").path))

    let empty = "empty-exact"
    let _ = try seedLegacy(empty)
    try fm.createDirectory(at:file(empty,"practice").deletingLastPathComponent(),withIntermediateDirectories:true)
    let first = legacyLaunch(empty)
    first.expect("nux-status","completed")
    first.close()

    let race = "publication-race"
    let _ = try seedLegacy(race)
    try DitLegacyStore.install(from:oldDirectory(race),into:file(race,"practice").deletingLastPathComponent(),
                               writableKeys:["dit.exact-spike.onboarding.v1","dit.exact-spike.practice.v1"]) { _ in
        try seed(race,"practice","existing exact bytes")
        return ["dit.exact-spike.onboarding.v1":"staged","dit.exact-spike.legacy.v1":"staged"]
    }
    let existing = try String(contentsOf:file(race,"practice"),encoding:.utf8)
    precondition(existing == "existing exact bytes" && !fm.fileExists(atPath:file(race,"onboarding").path))
    print("PASS existing Exact wins without reading the malformed source; timestamp 2000 and score 27 preserved. Empty destination imports and concurrent nonempty destination survives atomic publication.")
}

private func checkPartialValidSources() throws {
    let fm = FileManager.default
    func writeManifest(_ name: String,_ object: [String:Any]) throws {
        let dir = oldDirectory(name)
        try fm.createDirectory(at:dir,withIntermediateDirectories:true)
        try JSONSerialization.data(withJSONObject:object).write(to:dir.appendingPathComponent("manifest.json"))
    }
    try writeManifest("status-only",["dit-nux-status":"completed","unused-fixture-key":[0,1]])
    let completed = legacyLaunch("status-only")
    completed.expect("nux-status","completed")
    completed.expect("intro-hint","morse")
    completed.close()
    precondition(!fm.fileExists(atPath:file("status-only","practice").path))
    for (name, values, expected) in [
        ("current-hint", ["dit-intro-hint-step":"settings","dit-intro-hints-dismissed":"true"], "settings"),
        ("legacy-hint", ["dit-intro-hints-dismissed":"true"], "done"),
        ("broken-hint", ["dit-intro-hint-step":NSNull()], "morse"),
    ] as [(String,[String:Any],String)] {
        try writeManifest(name,values.merging(["dit-nux-status":"skipped"]) { a,_ in a })
        let session = legacyLaunch(name)
        session.expect("nux-status","skipped")
        session.expect("intro-hint",expected)
        session.close()
    }
    let data:[String:Any] = ["scores":["E":4],"updatedAt":1000]
    let inline = String(data:try JSONSerialization.data(withJSONObject:data),encoding:.utf8)!
    try writeManifest("early-learner",["dit-progress":inline])
    let early = legacyLaunch("early-learner")
    early.expect("nux-status","skipped")
    early.close()
    try writeManifest("pending-learner",["dit-progress":inline,"dit-nux-status":"pending",
        "dit-nux-state":#"{"step":"button_tutorial","learnerProfile":"known","didCompleteSoundCheck":true,"tutorialTapCount":2,"tutorialHoldCount":1}"#])
    let pending = legacyLaunch("pending-learner")
    pending.expect("nux-status","pending")
    pending.set("mode","nux")
    pending.command("nux","resume")
    pending.expect("nux-step","button_tutorial")
    pending.expect("nux-taps","2")
    pending.expect("nux-holds","1")
    pending.close()
    try fm.createDirectory(at:oldDirectory("empty-legacy"),withIntermediateDirectories:true)
    let clean = legacyLaunch("empty-legacy")
    clean.expect("nux-status","pending")
    clean.close()
    print("PASS inline-only completion, pre-onboarding positive score, explicit pending tutorial counters, and empty legacy directory. Unrelated manifest entries and unlisted blobs are unused.")
}
try checkMigratedValues()
private func continueImportedCourse() throws {
    let name = "legacy-offline"
    let original = try Data(contentsOf:oldDirectory(name).appendingPathComponent(legacyHash))
    let session = legacyLaunch(name)
    session.set("mode","guided")
    let target = session.values["guide-target"]!
    let inputs = ["E":".","T":"-","A":".-","N":"-.","I":"..","M":"--"]
    session.session.input("sequence",inputs[target]!)
    session.expect("guide-feedback","Correct")
    session.close()
    let reopened = legacyLaunch(name)
    reopened.expect("nux-enter","guided")
    reopened.set("mode","guided")
    reopened.expect("guide-phase","practice")
    let data = try exactRecord(name,"guided")["data"] as! NSDictionary
    let counts = data["progress"] as! NSDictionary
    precondition(counts["practiceAttempts"] as? Int == 6 && counts["practiceCorrect"] as? Int == 4)
    precondition(data["maxPackReached"] as? Int == 4)
    let source = try Data(contentsOf:oldDirectory(name).appendingPathComponent(legacyHash))
    precondition(source == original)
    reopened.close()
    print("PASS one correct answer advances the imported course from 3/5 to 4/6; another offline launch keeps it, with high-water 4 and original progress bytes preserved.")
}
try continueImportedCourse()
try checkLegacyFailures()
try checkLegacyPrecedence()
try checkPartialValidSources()

private func checkWidgetSessionRoot() throws {
    let support = root.appendingPathComponent("before-widget/Library/Application Support", isDirectory: true)
    let group = root.appendingPathComponent("shared-widget/data", isDirectory: true)
    let bundle = "com.tylerobinson.dit.exactspike"
    let original = support.appendingPathComponent("exact/\(bundle)/data", isDirectory: true)
    let derived = DitLegacyStore.sessionDirectory(hostData: group, privateSupport: support, bundleID: bundle, agent: false)
    precondition(derived?.standardizedFileURL == original.standardizedFileURL)
    let key = "dit-practice/dit.exact-spike.guided.v1"
    for (dir,phase) in [(original,"complete"),(group,"listen")] {
        try FileManager.default.createDirectory(at:dir.appendingPathComponent("dit-practice"),withIntermediateDirectories:true)
        try phase.write(to:dir.appendingPathComponent(key),atomically:true,encoding:.utf8)
    }
    let saved = try String(contentsOf:derived!.appendingPathComponent(key),encoding:.utf8)
    precondition(saved == "complete")
    precondition(DitLegacyStore.sessionDirectory(hostData:group,privateSupport:nil,bundleID:nil,agent:false) == nil)
    precondition(DitLegacyStore.sessionDirectory(hostData:group,privateSupport:nil,bundleID:nil,agent:true) == group)
    print("PASS WidgetKit opt-in keeps the pre-widget private graduation, ignores a stale shared round and preserves agent isolation.")
}
try checkWidgetSessionRoot()
