#if DIT_FIXTURE_TEST
private func verifyEmailAccounts() throws {
    let bundle = "com.tylerobinson.dit.exactspike"
    let run = UUID().uuidString
    let addr = "new-learner@example.invalid"
    let password = "  pad fixture  "
    func open(_ fault: String = "") throws -> DitFixtureAccounts {
        var env = ["DIT_ACCOUNT_FIXTURE":run]
        if !fault.isEmpty { env["DIT_ACCOUNT_FIXTURE_EMAIL_ERROR"] = fault }
        return try DitFixtureAccounts(environment:env,bundle:bundle,directory:root)!
    }
    func attempt(_ service: DitFixtureAccounts, _ create: Bool, _ email: String, _ secret: String) -> String {
        var reply: String?
        service.submitEmail(create:create,address:email,password:secret) { reply = $0 }
        precondition(reply == nil,"fixture result must be asynchronous")
        let deadline = Date().addingTimeInterval(4)
        while reply == nil && Date() < deadline { eventTurn() }
        precondition(reply != nil,"missing email fixture reply")
        eventTurn()
        return reply!
    }
    let service = try open()
    let app = Fixture(service.directory,asset,accounts:service)
    eventTurn()
    let url = service.directory.appendingPathComponent("synthetic-service.json")
    let old = try Data(contentsOf:url)
    precondition(attempt(service,false,"missing@example.invalid",password) == "Email or password is incorrect.")
    precondition(attempt(service,false,"learner-a@example.invalid","wrong") == "Email or password is incorrect.")
    precondition(attempt(service,false,"not-an-email",password) == "That email address is not valid.")
    precondition(attempt(service,true,addr,"short") == "Password is too weak. Use at least 6 characters.")
    precondition(attempt(service,true,"learner-a@example.invalid",password) == "An account already exists for that email. Sign in instead.")
    service.submitEmail(create:true,address:addr,password:password) { _ in preconditionFailure("dismissed request delivered") }
    service.cancelEmail()
    eventTurn()
    precondition(try! Data(contentsOf:url) == old)
    precondition(attempt(service,false,"  LEARNER-A@example.invalid  ","dit-fixture") == "ok")
    app.expect("pitch","640")
    service.choose("sign-out")
    eventTurn()
    precondition(attempt(service,true,"  NEW-LEARNER@example.invalid  ",password) == "ok")
    app.expect("nux-status","pending")
    app.expect("pitch","600")
    app.close()
    let next = try open()
    let cold = Fixture(next.directory,asset,accounts:next)
    eventTurn()
    cold.expect("nux-status","pending")
    // Update synced progress, then prove the credential survives the record update.
    precondition(next.progressIdentity?.account == addr && next.progressIdentity?.uid == "fixture-" + DitAccountFile.identifier(addr))
    var saved = false
    next.save(account:addr,replacing:"1",json:#"{"toneFrequency":700,"updatedAt":2500,"nuxCompleted":true}"#) {
        if case .saved = $0 { saved = true }
    }
    precondition(saved)
    next.choose("sign-out")
    eventTurn()
    precondition(attempt(next,false,addr,"pad fixture") == "Email or password is incorrect.")
    precondition(attempt(next,false,addr,password) == "ok")
    cold.expect("pitch","700")
    next.choose("B")
    eventTurn()
    cold.expect("pitch","720")
    next.choose("sign-out")
    eventTurn()
    cold.close()
    // Reset keeps the new identity and its verifier. Delete removes both.
    let actions = try open()
    precondition(attempt(actions,false,addr,password) == "ok")
    actions.choose("reset-check:" + addr)
    actions.choose("reset-online:" + addr)
    precondition(attempt(actions,false,addr,password) == "ok")
    actions.choose("delete:" + addr)
    eventTurn()
    eventTurn()
    precondition(attempt(actions,false,addr,password) == "Email or password is incorrect.")
    precondition(attempt(actions,true,addr,password) == "ok")
    actions.choose("sign-out")
    let contents = try String(contentsOf:url,encoding:.utf8)
    let journal = try String(contentsOf:service.directory.appendingPathComponent("operations.txt"),encoding:.utf8)
    precondition(!contents.contains(password) && !journal.contains(password) && !contents.contains("dit-fixture"))
    print("PASS fixture sign-in/creation, invalid email, shared bad-credential error, duplicate and weak-password errors, dismissal before mutation, cold restore, exact password whitespace, credential retained across progress save, and independent learners.")
    let failures = [(false,"network","A network error interrupted sign-in. Try again on a stable connection."),
                    (true,"network","A network error interrupted sign-up. Try again on a stable connection."),
                    (false,"disabled","This account has been disabled."),
                    (false,"throttled","Too many attempts. Try again in a few minutes."),
                    (false,"failed","We could not sign you in. Please try again."),
                    (true,"failed","We could not create your account. Please try again.")]
    for (create,fault,expected) in failures {
        let isolated = try open(fault)
        precondition(attempt(isolated,create,addr,password) == expected)
        precondition(attempt(isolated,false,addr,password) == "ok")
        isolated.choose("sign-out")
    }
    print("PASS six synthetic service faults deliver the shipped inline messages and allow a successful retry.")
}
try verifyEmailAccounts()
#endif
