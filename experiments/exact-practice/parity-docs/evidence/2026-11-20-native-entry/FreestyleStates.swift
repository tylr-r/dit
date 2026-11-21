import XCTest
final class FreestyleStates: XCTestCase {
    func testExact() { compare("exact","com.tylerobinson.dit.exactspike") }
    func testPinned() { compare("source","com.tylerobinson.dit") }
    private func compare(_ label:String,_ bundle:String) {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:bundle)
        app.activate()
        let title=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@", "Mode:")).firstMatch
        let exactTitle=app.buttons["Practice. Choose a practice mode"]
        if !app.buttons.matching(NSPredicate(format:"label BEGINSWITH[c] %@", "Clear")).firstMatch.exists {
            if title.exists {title.tap()} else if exactTitle.exists {exactTitle.tap()} else {
                app.buttons["nux-target-modes"].tap()
            }
            let choice = app.buttons.matching(NSPredicate(format:"label =[c] %@", "Freestyle")).firstMatch
            if !choice.waitForExistence(timeout:4) { title.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap() }
            XCTAssertTrue(choice.waitForExistence(timeout:10))
            choice.tap()
        }
        let clear=app.buttons.matching(NSPredicate(format:"label BEGINSWITH[c] %@", "Clear")).firstMatch
        XCTAssertTrue(clear.waitForExistence(timeout:10))
        clear.tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label ==[c] %@", "Tap to dit or dah")).firstMatch.waitForExistence(timeout:8))
        capture(label+"-freestyle-idle")
        let key=app.buttons[label=="source" ? "Tap for dot, hold for dah" : "dit-native-morse-key"]
        XCTAssertTrue(key.isHittable)
        key.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.06)
        let e=app.staticTexts.matching(NSPredicate(format:"label == %@", "E")).firstMatch
        XCTAssertTrue(e.waitForExistence(timeout:8))
        capture(label+"-freestyle-e")
        clear.tap()
        XCTAssertTrue(e.waitForNonExistence(timeout:8))
    }
    private func capture(_ name:String) {
        let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        a.name=name
        a.lifetime = .keepAlways
        add(a)
    }
}
