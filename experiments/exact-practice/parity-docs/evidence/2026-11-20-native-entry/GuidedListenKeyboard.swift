import XCTest

final class GuidedListenKeyboard: XCTestCase {
    func testNativeFirstPrompt() {
        let app=XCUIApplication(bundleIdentifier:"com.tylerobinson.dit.exactspike")
        app.activate()
        let e=app.buttons["Type E"], t=app.buttons["Type T"]
        XCTAssertTrue(e.waitForExistence(timeout:12))
        guard e.exists else { return }
        XCTAssertTrue(e.isEnabled && t.isEnabled)
        let all=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@", "Type "))
        XCTAssertEqual(all.count,36)
        XCTAssertFalse(app.buttons["Type A"].isEnabled)
        let replay=app.buttons["Play morse letter sound"]
        replay.tap()
        capture("exact-guided-listen-after")
        e.tap()
        let correct=app.staticTexts.matching(NSPredicate(format:"label =[c] %@", "Correct")).firstMatch
        let wrong=app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH[c] %@", "It was ")).firstMatch
        XCTAssertTrue(correct.exists || wrong.exists)
        XCTAssertFalse(e.isEnabled)
        capture("exact-guided-listen-reveal")
        let enabled=NSPredicate(format:"enabled == true")
        expectation(for:enabled,evaluatedWith:t)
        waitForExpectations(timeout:10)
    }
    private func capture(_ name:String) {
        let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        a.name=name
        a.lifetime = .keepAlways
        add(a)
    }
}
