import XCTest

final class ProgressScreen: XCTestCase {
    func testExact() { exercise("exact", "com.tylerobinson.dit.exactspike") }
    func testPinned() { exercise("source", "com.tylerobinson.dit") }
    private func exercise(_ label:String,_ bundle:String) {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:bundle)
        app.activate()
        let open=app.buttons["Open progress"]
        XCTAssertTrue(open.waitForExistence(timeout:30))
        let title=app.staticTexts.matching(NSPredicate(format:"label ==[c] %@", "Progress")).firstMatch
        let mode=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@", "Mode:")).firstMatch
        if !app.buttons["Close reference"].exists {
            if mode.exists && mode.label != "Mode: Listen" {
                mode.tap()
                let listen=app.buttons["Listen"]
                if !listen.waitForExistence(timeout:4) { mode.tap() }
                listen.tap()
            }
            let chars=app.descendants(matching:.any).matching(NSPredicate(format:"label ==[c] %@", "Characters")).firstMatch
            if chars.waitForExistence(timeout:8) { chars.tap() }
            open.tap()
        }
        if !title.waitForExistence(timeout:4) { open.tap() }
        XCTAssertTrue(title.waitForExistence(timeout:10))
        let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        shot.name=label+"-progress"
        shot.lifetime = .keepAlways
        add(shot)
        let tree=XCTAttachment(string:app.debugDescription)
        tree.name=label+"-progress-tree"
        tree.lifetime = .keepAlways
        add(tree)
        let reset=app.buttons["Reset scores"]
        XCTAssertTrue(reset.exists)
        reset.tap()
        let alert=app.alerts["Reset Progress"]
        XCTAssertTrue(alert.waitForExistence(timeout:8))
        alert.buttons["Cancel"].tap()
        XCTAssertTrue(reset.waitForExistence(timeout:8))
        let tile=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@", "A, ")).firstMatch
        XCTAssertTrue(tile.exists)
        if !tile.isHittable { app.swipeUp() }
        tile.tap()
        app.buttons["Close reference"].tap()
        XCTAssertTrue(reset.waitForNonExistence(timeout:8))
    }
}
