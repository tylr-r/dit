import XCTest

final class ListenRound: XCTestCase {
    func testExact() { exercise("exact", "com.tylerobinson.dit.exactspike") }
    func testPinned() { exercise("source", "com.tylerobinson.dit") }

    private func exercise(_ label: String, _ bundle: String) {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: bundle)
        app.activate()
        let title = app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@", "Mode:")).firstMatch
        XCTAssertTrue(title.waitForExistence(timeout:30))
        if title.label != "Mode: Listen" {
            let choice = app.buttons["Listen"]
            title.tap()
            if !choice.waitForExistence(timeout:4) { title.tap() }
            XCTAssertTrue(choice.waitForExistence(timeout:8))
            choice.tap()
        }
        let words = app.descendants(matching:.any).matching(NSPredicate(format:"label ==[c] %@", "Words")).firstMatch
        let start = app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Start listening")).firstMatch
        let chars = app.descendants(matching:.any).matching(NSPredicate(format:"label ==[c] %@", "Characters")).firstMatch
        if !start.exists {
            XCTAssertTrue(words.waitForExistence(timeout:12))
            if app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Replay")).firstMatch.exists { chars.tap() }
            words.tap()
        }
        XCTAssertTrue(start.waitForExistence(timeout:15))
        capture(label+"-listen-ready")
        start.tap()
        let choices = app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@ AND NOT label CONTAINS %@", "Answer ", "concealed"))
        XCTAssertTrue(choices.firstMatch.waitForExistence(timeout:25))
        XCTAssertEqual(choices.count,4)
        capture(label+"-listen-choose")
        let tiles = choices.allElementsBoundByIndex.map(\.frame)
        XCTAssertEqual(tiles[0].midY, tiles[1].midY, accuracy:2)
        XCTAssertEqual(tiles[2].midY, tiles[3].midY, accuracy:2)
        XCTAssertGreaterThan(tiles[2].minY, tiles[0].minY)
        XCTAssertTrue(app.frame.contains(app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Replay")).firstMatch.frame))
        choices.element(boundBy:0).tap()
        let next = app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Next")).firstMatch
        XCTAssertTrue(next.waitForExistence(timeout:15))
        capture(label+"-listen-graded")
        let replay = app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Replay")).firstMatch
        replay.tap()
        XCTAssertTrue(choices.firstMatch.waitForExistence(timeout:25))
        XCTAssertTrue(next.waitForExistence(timeout:25))
        XCTAssertEqual(choices.count,4)
    }
    private func capture(_ name:String) {
        let a = XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        a.name=name
        a.lifetime = .keepAlways
        add(a)
    }
}
