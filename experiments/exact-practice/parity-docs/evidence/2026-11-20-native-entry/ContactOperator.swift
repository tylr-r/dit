import XCTest

final class ContactOperator: XCTestCase {
    func testExact() { captureOperator("exact","com.tylerobinson.dit.exactspike") }
    func testLocalOracle() { captureOperator("oracle","com.tylerobinson.dit.contactfixture") }

    private func captureOperator(_ name: String,_ bundle: String) {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: bundle)
        app.launch()
        let mode = app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@ OR label CONTAINS[c] %@", "Mode:", "Choose a practice mode")).firstMatch
        XCTAssertTrue(mode.waitForExistence(timeout:60))
        mode.tap()
        let contact=app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Conversation")).firstMatch
        if !contact.waitForExistence(timeout:4) { mode.tap() }
        XCTAssertTrue(contact.waitForExistence(timeout:12));contact.tap()
        func start(_ direction: String) {
            let button=app.buttons[direction]
            XCTAssertTrue(button.waitForExistence(timeout:12));button.tap()
            let allow=app.buttons.matching(NSPredicate(format:"label BEGINSWITH[c] %@", "Allow")).firstMatch
            XCTAssertTrue(allow.waitForExistence(timeout:10));allow.tap()
        }
        func shot(_ state: String) {
            RunLoop.current.run(until:Date().addingTimeInterval(0.9))
            let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
            a.name=name+"-operator-"+state;a.lifetime = .keepAlways;add(a)
        }
        start("Send first")
        let key=app.buttons.matching(NSPredicate(format:"label CONTAINS[c] %@ OR label == %@", "Morse key", "Tap for dot, hold for dah")).firstMatch
        XCTAssertTrue(key.waitForExistence(timeout:20))
        let send=app.buttons["Send"],backspace=app.buttons["Backspace"],clear=app.buttons["Clear"]
        XCTAssertFalse(send.isEnabled)
        XCTAssertFalse(backspace.isEnabled); XCTAssertFalse(clear.isEnabled)
        shot("empty")
        key.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.065)
        let enabled=expectation(for:NSPredicate(format:"isEnabled == true"),evaluatedWith:send)
        wait(for:[enabled],timeout:15)
        shot("draft")
        backspace.tap()
        XCTAssertFalse(send.isEnabled)
        app.buttons["End QSO"].tap()
        let again=app.buttons["New QSO"]
        XCTAssertTrue(again.waitForExistence(timeout:10));again.tap()
        start("Receive first")
        let reply=app.buttons.matching(NSPredicate(format:"label ==[c] %@ OR label ==[c] %@", "Reply","Start my turn")).firstMatch
        XCTAssertTrue(reply.waitForExistence(timeout:40))
        shot("completed-rx")
        reply.tap()
        XCTAssertTrue(key.waitForExistence(timeout:12))
        shot("reply")
        let reveal=app.buttons["Reveal received message"]
        XCTAssertTrue(reveal.waitForExistence(timeout:10))
        XCTAssertFalse(app.staticTexts["CQ K"].exists)
        reveal.tap()
        XCTAssertTrue(app.staticTexts["CQ K"].waitForExistence(timeout:10))
        shot("revealed")
        app.buttons["Prosigns"].tap()
        XCTAssertTrue(app.staticTexts["Prosigns are sent as a single continuous character."].waitForExistence(timeout:8))
        app.buttons["Close prosigns"].tap()
        app.buttons["Replay"].tap()
        XCTAssertTrue(reply.waitForExistence(timeout:25))
        let field=app.textViews.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout:8))
        let headerY=mode.frame.midY
        field.tap();field.typeText("cq x")
        let check=app.buttons["Check copy"]
        XCTAssertTrue(check.isHittable)
        check.tap()
        let comparison=app.staticTexts.matching(NSPredicate(format:"label CONTAINS[c] %@","3 / 4 matched")).firstMatch
        XCTAssertTrue(comparison.waitForExistence(timeout:10))
        let keyboard=app.keyboards.firstMatch
        XCTAssertTrue(keyboard.exists)
        XCTAssertLessThanOrEqual(comparison.frame.maxY,keyboard.frame.minY + 1,"The grade must be visible above the software keyboard")
        XCTAssertEqual(mode.frame.midY,headerY,accuracy:3,"Checking copy should scroll the history while keeping navigation in place")
        XCTAssertLessThanOrEqual(app.buttons["End QSO"].frame.maxY,keyboard.frame.minY + 1)
        shot("checked-copy")
        app.buttons["End QSO"].tap()
        XCTAssertTrue(again.waitForExistence(timeout:10))
    }
}
