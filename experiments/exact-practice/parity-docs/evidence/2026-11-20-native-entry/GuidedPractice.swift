import XCTest

final class GuidedPractice: XCTestCase {
    func testExactPackOneTeach() {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier:"com.tylerobinson.dit.exactspike")
        app.activate()
        XCTAssertTrue(app.staticTexts["2 remaining"].waitForExistence(timeout:30))
        let instruction = app.staticTexts.matching(NSPredicate(format:"label =[c] %@", "Repeat what you heard")).firstMatch
        XCTAssertTrue(instruction.exists)
        capture("exact-pack-one-resting")
        let play = app.buttons["Play target character"]
        XCTAssertTrue(play.isHittable)
        play.tap()
        let key = app.buttons["dit-native-morse-key"]
        XCTAssertTrue(key.isHittable)
        key.press(forDuration:0.06)
        XCTAssertTrue(app.staticTexts["1 remaining"].waitForExistence(timeout:10))
        capture("exact-pack-one-after-e")
        key.press(forDuration:0.55)
        XCTAssertTrue(instruction.waitForExistence(timeout:10))
        XCTAssertTrue(app.staticTexts["1 remaining"].exists)
        app.buttons["Settings"].tap()
        let about = app.buttons["Open about"]
        for _ in 0..<6 where !about.isHittable { app.swipeUp() }
        XCTAssertTrue(about.isHittable)
        about.tap()
        XCTAssertTrue(app.staticTexts["Tap that big button. Quick taps make dots, longer presses make dashes."].waitForExistence(timeout:10))
        capture("exact-about")
        app.buttons["Close about"].tap()
        XCTAssertTrue(instruction.waitForExistence(timeout:10))
    }
    private func capture(_ name:String) {
        let attachment = XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
