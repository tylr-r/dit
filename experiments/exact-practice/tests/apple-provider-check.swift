#if DIT_FIXTURE_TEST
private func verifyAppleProvider() throws {
    let run = UUID().uuidString
    let bundle = "com.tylerobinson.dit.exactspike"
    func open(_ outcome: String) throws -> DitFixtureAccounts {
        try DitFixtureAccounts(environment: ["DIT_ACCOUNT_FIXTURE":run, "DIT_ACCOUNT_FIXTURE_APPLE":outcome],
                               bundle:bundle, directory:root)!
    }
    let bare = try DitFixtureAccounts(environment:["DIT_ACCOUNT_FIXTURE_APPLE":"A"], bundle:bundle, directory:root)
    let wrong = try DitFixtureAccounts(environment:["DIT_ACCOUNT_FIXTURE":run,"DIT_ACCOUNT_FIXTURE_APPLE":"A"],
                                       bundle:"com.tylerobinson.dit", directory:root)
    precondition(bare == nil && wrong == nil)
    let seed = try open("")
    let app = Fixture(seed.directory, asset, accounts:seed)
    eventTurn()
    seed.choose("A")
    eventTurn()
    seed.choose("B")
    eventTurn()
    let progress = #"{"learnerProfile":"known","nuxCompleted":true,"toneFrequency":740,"scores":{"E":7},"customLetters":["E"],"updatedAt":3000}"#
    seed.save(account:"B",replacing:"1",json:progress) { reply in
        guard case .saved("2") = reply else { preconditionFailure("seed B progress") }
    }
    seed.choose("sign-out")
    eventTurn()
    app.close()
    let database = seed.directory.appendingPathComponent("synthetic-service.json")
    func privateFile(_ id: String) -> URL {
        seed.directory.appendingPathComponent("dit-accounts/" + DitAccountFile.identifier(id) + ".json")
    }
    let before = try Data(contentsOf:database)
    let other = try Data(contentsOf:privateFile("A"))
    let priorB = try Data(contentsOf:privateFile("B"))
    for (setting,result) in [("","failed"),("unrecognized","failed"),("cancel","cancelled"),
                             ("network","network"),("different-credential","different-credential"),("failed","failed")] {
        let service = try open(setting)
        precondition(service.appleSignInAvailable == (!setting.isEmpty && setting != "unrecognized"))
        precondition(service.submitApple() == result)
        precondition(try! Data(contentsOf:database) == before)
        precondition(try! Data(contentsOf:privateFile("A")) == other)
        precondition(try! Data(contentsOf:privateFile("B")) == priorB)
    }
    let provider = try open("B")
    let active = Fixture(provider.directory,asset,accounts:provider)
    eventTurn()
    precondition(provider.submitApple() == "ok")
    eventTurn()
    active.expect("pitch","740")
    active.expect("nux-status","skipped")
    active.set("mode","practice")
    active.expect("score","7")
    precondition(provider.submitApple() == "failed")
    active.close()
    let restored = try open("")
    let cold = Fixture(restored.directory,asset,accounts:restored)
    eventTurn()
    cold.expect("nux-status","skipped")
    cold.expect("pitch","740")
    cold.set("mode","practice")
    cold.expect("score","7")
    precondition(try! Data(contentsOf:privateFile("A")) == other)
    cold.close()
    print("PASS Apple launch gates, cancellation and errors leave both learners untouched; B restores 7 points, 740 Hz and completed onboarding, including restart with the provider disabled.")
}
private func verifyGoogleSwitch() throws {
    let run = UUID().uuidString
    func open(_ script: String) throws -> DitFixtureAccounts {
        try DitFixtureAccounts(environment:["DIT_ACCOUNT_FIXTURE":run, "DIT_ACCOUNT_FIXTURE_GOOGLE":script],
                               bundle:"com.tylerobinson.dit.exactspike", directory:root)!
    }
    let service = try open("cancel,network,different-credential,failed,A,B")
    precondition(service.googleSignInAvailable && !service.appleSignInAvailable)
    for invalid in ["", "A,unknown", "B,"] {
        let unconfigured = try open(invalid)
        precondition(!unconfigured.googleSignInAvailable && unconfigured.submitGoogle() == "failed")
    }
    func file(_ id: String) -> URL {
        service.directory.appendingPathComponent("dit-accounts/" + DitAccountFile.identifier(id) + ".json")
    }
    let app = Fixture(service.directory, asset, accounts:service)
    eventTurn()
    for (id, pitch, points) in [("A",660,3),("B",740,8)] {
        let body = "{\"learnerProfile\":\"known\",\"nuxCompleted\":true,\"toneFrequency\":\(pitch),\"scores\":{\"E\":\(points)},\"customLetters\":[\"E\"],\"updatedAt\":3000}"
        service.choose(id)
        eventTurn()
        service.save(account:id,replacing:"1",json:body) { result in
            guard case .saved("2") = result else { preconditionFailure("Could not seed " + id) }
        }
        service.choose("sign-out")
        eventTurn()
    }
    let database = service.directory.appendingPathComponent("synthetic-service.json")
    let before = try Data(contentsOf:database)
    let privateA = try Data(contentsOf:file("A"))
    let privateB = try Data(contentsOf:file("B"))
    for expected in ["failed", "network", "different-credential", "failed"] {
        precondition(service.submitGoogle() == expected)
        eventTurn()
        precondition(try! Data(contentsOf:database) == before)
        precondition(try! Data(contentsOf:file("A")) == privateA)
        precondition(try! Data(contentsOf:file("B")) == privateB)
    }
    precondition(service.submitGoogle() == "ok")
    eventTurn()
    app.expect("pitch","660")
    app.set("mode","practice")
    app.expect("score","3")
    precondition(service.submitGoogle() == "failed")
    service.choose("sign-out")
    eventTurn()
    let savedA = try Data(contentsOf:file("A"))
    precondition(service.submitGoogle() == "ok")
    eventTurn()
    app.expect("pitch","740")
    app.set("mode","practice")
    app.expect("score","8")
    app.close()
    let restored = try open("")
    let cold = Fixture(restored.directory,asset,accounts:restored)
    eventTurn()
    cold.expect("nux-status","skipped")
    cold.expect("pitch","740")
    cold.set("mode","practice")
    cold.expect("score","8")
    precondition(try! Data(contentsOf:file("A")) == savedA)
    cold.close()
    print("PASS Google cancel and errors preserve both files; retry restores A at 660 Hz / 3 points, sign-out and Google switch restore B at 740 Hz / 8 points, including cold restart.")
}
try verifyGoogleSwitch()
try verifyAppleProvider()
#endif
