import XCTest

final class LocalContact: XCTestCase {
    func testOperatorHandoff() throws {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "com.tylerobinson.dit.exactspike")
        app.activate()
        let mode = app.buttons["Mode: Practice"]
        XCTAssertTrue(mode.waitForExistence(timeout: 50))
        mode.tap()
        app.buttons["Conversation"].tap()
        let receive = app.buttons["Receive first"]
        XCTAssertTrue(receive.waitForExistence(timeout: 10))
        receive.tap()
        app.buttons["Cancel"].tap()
        XCTAssertTrue(receive.waitForExistence(timeout: 10))
        receive.tap()
        app.buttons["Allow local simulation"].tap()
        let handoff = app.buttons["Start my turn"]
        XCTAssertTrue(handoff.waitForExistence(timeout: 35))
        app.buttons["Reveal"].tap()
        XCTAssertTrue(app.staticTexts["CQ K"].waitForExistence(timeout: 8))
        capture("local-contact-rx")
        handoff.tap()
        let key = app.buttons["dit-native-morse-key"]
        XCTAssertTrue(key.waitForExistence(timeout: 12))
        key.tap()
        let send = app.buttons["Send"]
        let enabled = expectation(for: NSPredicate(format:"isEnabled == true"), evaluatedWith:send)
        wait(for:[enabled], timeout:12)
        send.tap()
        XCTAssertTrue(handoff.waitForExistence(timeout: 30))
        capture("local-contact-second-rx")
        app.buttons["End QSO"].tap()
        XCTAssertTrue(app.buttons["New QSO"].waitForExistence(timeout: 10))
    }
    private func capture(_ name: String) {
        let picture = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        picture.name = name
        picture.lifetime = .keepAlways
        add(picture)
    }
}
