import XCTest

final class MatchedSettings: XCTestCase {
    func testExactSettings() { compare("exact","com.tylerobinson.dit.exactspike") }
    func testPinnedSettings() { compare("source","com.tylerobinson.dit") }
    private func compare(_ label:String,_ bundle:String) {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier:bundle)
        app.activate()
        let settings = app.buttons["Settings"]
        XCTAssertTrue(settings.waitForExistence(timeout:60))
        settings.tap()
        let close = app.buttons.matching(NSPredicate(format:"label CONTAINS[c] %@", "Close")).firstMatch
        XCTAssertTrue(app.buttons["Increase tone pitch"].waitForExistence(timeout:15))
        XCTAssertTrue(close.exists)
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        shot.name = label + "-settings"
        shot.lifetime = .keepAlways
        add(shot)
        let hierarchy = XCTAttachment(string:app.debugDescription)
        hierarchy.name = label + "-settings-tree"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)
        if label == "source" { app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.065)).tap() } else { close.tap() }
        XCTAssertTrue(app.buttons["Increase tone pitch"].waitForNonExistence(timeout:10))
        XCTAssertTrue(settings.waitForExistence(timeout:15))
    }
}
