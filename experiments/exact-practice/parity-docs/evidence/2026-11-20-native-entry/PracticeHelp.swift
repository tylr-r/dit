import XCTest

final class PracticeHelp: XCTestCase {
    func testHelpers() {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:"com.tylerobinson.dit.exactspike")
        app.activate()
        XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout:30))
        app.buttons["Settings"].tap()
        let helpers=app.buttons["Toggle helper options"]
        for _ in 0..<8 where !helpers.isHittable { app.swipeUp() }
        XCTAssertTrue(helpers.isHittable)
        helpers.tap()
        let hint=app.switches["Show hints"], mnemonic=app.switches["Show mnemonics"]
        for _ in 0..<6 where !mnemonic.isHittable { app.swipeUp() }
        XCTAssertTrue(hint.isHittable && mnemonic.isHittable)
        if hint.value as? String != "1" { hint.tap() }
        if mnemonic.value as? String != "1" { mnemonic.tap() }
        app.buttons["Close settings"].tap()
        let pattern=app.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH %@", "Hint: ")).firstMatch
        XCTAssertTrue(pattern.waitForExistence(timeout:8))
        let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        shot.name="explicit-practice-help"
        shot.lifetime = .keepAlways
        add(shot)
        app.buttons["Settings"].tap()
        for _ in 0..<8 where !helpers.isHittable { app.swipeUp() }
        helpers.tap()
        for _ in 0..<6 where !mnemonic.isHittable { app.swipeUp() }
        hint.tap()
        mnemonic.tap()
        app.buttons["Close settings"].tap()
        XCTAssertTrue(pattern.waitForNonExistence(timeout:7))
    }
}
