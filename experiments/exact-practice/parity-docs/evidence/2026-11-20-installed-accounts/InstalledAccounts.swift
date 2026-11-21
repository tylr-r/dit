import XCTest

final class InstalledAccounts: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.tylerobinson.dit.exactspike")
    let run = UUID().uuidString
    func launch(_ behavior: String = "") {
        app.terminate()
        app.launchEnvironment["DIT_ACCOUNT_FIXTURE"] = run
        app.launchEnvironment["DIT_ACCOUNT_FIXTURE_READ"] = behavior
        app.launch()
    }
    func button(_ name: String, timeout: Double = 20) -> XCUIElement {
        let el = app.buttons[name]
        XCTAssertTrue(el.waitForExistence(timeout:timeout), "Missing " + name + " " + String(app.debugDescription.prefix(3500)))
        return el
    }
    func enter(_ who: String) {
        button("Sign in").tap()
        button("Fixture learner " + who, timeout:8).tap()
        _ = button("Settings")
    }
    func openSettings(_ hz: String) {
        button("Settings").tap()
        let pitch = app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@", hz + " Hz")).firstMatch
        XCTAssertTrue(pitch.waitForExistence(timeout:15),String(app.debugDescription.prefix(5000)))
    }
    func bottom() {
        let signOut = app.buttons["Sign out"]
        for _ in 0..<5 {
            if signOut.exists && signOut.isHittable {return}
            let start = app.coordinate(withNormalizedOffset:CGVector(dx:0.55,dy:0.86))
            let end = app.coordinate(withNormalizedOffset:CGVector(dx:0.55,dy:0.24))
            start.press(forDuration:0.08,thenDragTo:end,withVelocity:.fast,thenHoldForDuration:0)
        }
    }
    func attach(_ name:String) {
        let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        a.name=name; a.lifetime = .keepAlways; add(a)
    }
    func testInstalledLifecycle() {
        continueAfterFailure=false
        print("SYNTHETIC RUN",run)
        launch()
        enter("A")
        openSettings("640")
        button("Increase tone pitch").tap()
        XCTAssertTrue(app.staticTexts["660 Hz"].waitForExistence(timeout:12))
        attach("A-changed-pitch")
        launch("reject-first")
        openSettings("660")
        attach("A-cold-offline")
        launch("hold-first")
        openSettings("660")
        bottom()
        button("Sign out").tap()
        enter("B")
        openSettings("720")
        bottom()
        XCTAssertTrue(app.staticTexts["learner-b@example.invalid"].exists)
        attach("B-after-sign-out")
        button("Sign out").tap()
        enter("A")
        openSettings("660")
        attach("A-restored-again")
        print("INSTALLED ACCOUNT FLOW passed",run)
    }
}
