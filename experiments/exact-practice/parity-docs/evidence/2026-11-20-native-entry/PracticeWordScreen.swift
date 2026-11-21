import XCTest

final class PracticeWordScreen: XCTestCase {
    func testSourceWord() { compare("source","com.tylerobinson.dit") }
    func testExactWord() { compare("exact","com.tylerobinson.dit.exactspike") }
    private func compare(_ label:String,_ bundle:String) {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:bundle)
        app.activate()
        let settings=app.buttons["Settings"]
        XCTAssertTrue(settings.waitForExistence(timeout:50))
        if !app.buttons["Increase tone pitch"].exists {
            settings.tap()
            if !app.buttons["Increase tone pitch"].waitForExistence(timeout:8) { settings.tap() }
        }
        XCTAssertTrue(app.buttons["Increase tone pitch"].waitForExistence(timeout:15))
        let words=app.switches["Practice Words"]
        if !words.exists && app.buttons["Toggle practice settings"].exists { app.buttons["Toggle practice settings"].tap() }
        XCTAssertTrue(words.waitForExistence(timeout:8))
        for _ in 0..<4 where !words.isHittable {
            app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.79)).press(forDuration:0.12,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.40)))
        }
        XCTAssertTrue(words.isHittable && words.isEnabled)
        if words.value as? String != "1" { words.tap() }
        if label=="exact" { app.buttons["Close settings"].tap() }
        else { app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.065)).tap() }
        let position=app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH[c] %@", "Letter 1 of ")).firstMatch
        XCTAssertTrue(position.waitForExistence(timeout:15))
        let img=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        img.name=label+"-practice-word"
        img.lifetime = .keepAlways
        add(img)
        let tree=XCTAttachment(string:app.debugDescription)
        tree.name=label+"-word-tree"
        tree.lifetime = .keepAlways
        add(tree)
        app.buttons["Play target character"].tap()
    }
}
