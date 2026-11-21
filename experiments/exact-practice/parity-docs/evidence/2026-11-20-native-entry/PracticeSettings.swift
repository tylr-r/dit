import XCTest

final class PracticeSettings: XCTestCase {
    func testPlaybackSettings() {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier:"com.tylerobinson.dit.exactspike")
        app.activate()
        XCTAssertTrue(app.staticTexts["1 remaining"].waitForExistence(timeout:30))
        capture("exact-teach-final-one")
        app.buttons["Settings"].tap()
        let pitch = app.buttons["Increase tone pitch"]
        XCTAssertTrue(pitch.waitForExistence(timeout:10))
        XCTAssertTrue(pitch.isHittable)
        capture("exact-settings-after")
        pitch.tap()
        XCTAssertTrue(app.staticTexts["620 Hz"].waitForExistence(timeout:5))
        app.buttons["Decrease tone pitch"].tap()
        XCTAssertTrue(app.staticTexts["600 Hz"].waitForExistence(timeout:5))
        app.buttons["Test sound"].tap()
        XCTAssertTrue(app.buttons["Close settings"].isHittable)
        app.buttons["Close settings"].tap()
        XCTAssertTrue(app.staticTexts["1 remaining"].waitForExistence(timeout:10))
    }
    private func capture(_ name:String) {
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        shot.name=name
        shot.lifetime = .keepAlways
        add(shot)
    }
}
