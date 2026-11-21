import XCTest

final class ConversationEntry: XCTestCase {
    func testExact() { exercise("exact","com.tylerobinson.dit.exactspike") }
    func testPinned() { exercise("source","com.tylerobinson.dit") }
    private func exercise(_ name:String,_ bundle:String) {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:bundle)
        app.launch()
        let settings=app.buttons["Settings"]
        XCTAssertTrue(settings.waitForExistence(timeout:45))
        let picker=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@ OR label CONTAINS[c] %@", "Mode:", "Choose a practice mode")).firstMatch
        XCTAssertTrue(picker.waitForExistence(timeout:8))
        picker.tap()
        let choice=app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Conversation")).firstMatch
        if !choice.waitForExistence(timeout:4) {picker.tap()}
        XCTAssertTrue(choice.waitForExistence(timeout:10));choice.tap()
        let send=app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Send first")).firstMatch
        let receive=app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Receive first")).firstMatch
        XCTAssertTrue(send.waitForExistence(timeout:10))
        XCTAssertTrue(receive.exists)
        XCTAssertTrue(app.staticTexts["Do you want to send or receive first?"].exists)
        shot(name+"-conversation-idle")
        for (direction,control) in [("send",send),("receive",receive)] {
            control.tap()
            let cancel=app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Cancel")).firstMatch
            XCTAssertTrue(cancel.waitForExistence(timeout:8))
            let alert = app.alerts.firstMatch
            XCTAssertTrue(alert.exists)
            XCTAssertTrue(alert.buttons["Cancel"].exists)
            shot(name+"-conversation-consent-"+direction)
            cancel.tap()
            XCTAssertTrue(send.waitForExistence(timeout:8))
        }
        if name == "exact" {
            send.tap()
            let allow = app.alerts.firstMatch.buttons["Allow"]
            XCTAssertTrue(allow.waitForExistence(timeout:8))
            allow.tap()
            let key = app.buttons["dit-native-morse-key"]
            XCTAssertTrue(key.waitForExistence(timeout:10))
            key.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.065)
            let reply = app.buttons["Send"]
            let canSend = expectation(for:NSPredicate(format:"isEnabled == true"), evaluatedWith:reply)
            wait(for:[canSend],timeout:10)
            app.buttons["End QSO"].tap()
            let newContact = app.buttons["New QSO"]
            XCTAssertTrue(newContact.waitForExistence(timeout:10))
            newContact.tap()
            XCTAssertTrue(send.waitForExistence(timeout:10))
        }
    }
    private func shot(_ name:String) {
        RunLoop.current.run(until:Date().addingTimeInterval(1.2))
        let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)
    }
}
