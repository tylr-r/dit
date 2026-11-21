import XCTest

final class BeginnerLesson: XCTestCase {
    func testExactLesson() { lesson("exact","com.tylerobinson.dit.exactspike") }
    func testPinnedLesson() { lesson("source","com.tylerobinson.dit") }

    private func lesson(_ label:String, _ bundle:String) {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier:bundle)
        app.activate()
        let tutorial = app.staticTexts["Meet the Morse key"]
        let next = app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Continue")).firstMatch
        if !tutorial.waitForExistence(timeout:5) {
            let local = app.buttons["Stay signed out"]
            XCTAssertTrue(local.waitForExistence(timeout:90))
            local.tap()
            let beginner = app.buttons["Learn Morse from the basics"]
            XCTAssertTrue(beginner.waitForExistence(timeout:12))
            beginner.tap()
            for _ in 0..<3 {
                XCTAssertTrue(next.waitForExistence(timeout:10))
                next.tap()
            }
            let speaker = app.buttons["Test sound"]
            XCTAssertTrue(speaker.waitForExistence(timeout:10))
            speaker.tap()
            next.tap()
            XCTAssertTrue(tutorial.waitForExistence(timeout:15))
        }
        let key = app.buttons[label == "source" ? "Tap for dot, hold for dah" : "dit-native-morse-key"]
        XCTAssertTrue(key.waitForExistence(timeout:10))
        capture(label + "-key-ready")
        let holdInstruction = app.staticTexts["Now hold 3 times"]
        for _ in 0..<8 {
            if holdInstruction.exists { break }
            key.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap()
            RunLoop.current.run(until: Date().addingTimeInterval(0.35))
        }
        XCTAssertTrue(app.staticTexts["Now hold 3 times"].waitForExistence(timeout:8))
        capture(label + "-key-hold")
        let stages = app.staticTexts["How you'll learn"]
        for _ in 0..<6 {
            if stages.exists { break }
            key.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.75)
            RunLoop.current.run(until: Date().addingTimeInterval(0.9))
        }
        finishLesson(app,label,next)
    }
    func testContinuePinnedStages() {
        let app = XCUIApplication(bundleIdentifier:"com.tylerobinson.dit")
        app.activate()
        finishLesson(app,"source",app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Continue")).firstMatch)
    }
    private func finishLesson(_ app:XCUIApplication, _ label:String, _ next:XCUIElement) {
        XCTAssertTrue(app.staticTexts["How you'll learn"].waitForExistence(timeout:15))
        XCTAssertTrue(app.staticTexts["Hear a letter, tap the matching sound"].waitForExistence(timeout:12))
        RunLoop.current.run(until:Date().addingTimeInterval(2.2))
        capture(label + "-stages")
        next.tap()
        XCTAssertTrue(app.staticTexts["Your first letters"].waitForExistence(timeout:15))
        capture(label + "-first-pack")
        app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Start first lesson")).firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Daily nudge"].waitForExistence(timeout:15))
        capture(label + "-reminder")
        app.buttons["Skip reminder"].tap()
        XCTAssertTrue(app.staticTexts["Daily nudge"].waitForNonExistence(timeout:15))
        RunLoop.current.run(until:Date().addingTimeInterval(1))
        capture(label + "-lesson")
    }
    private func capture(_ name:String) {
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }
}
