import XCTest

final class QCodeRound: XCTestCase {
    func testExact() { exercise("exact", "com.tylerobinson.dit.exactspike") }
    func testPinned() { exercise("source", "com.tylerobinson.dit") }

    private func exercise(_ label: String, _ bundle: String) {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: bundle)
        app.terminate()
        app.launch()
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
        
        let menu=app.descendants(matching:.any).matching(NSPredicate(format:"label CONTAINS[c] %@ OR label ==[c] %@","Word vocabulary","Common words")).firstMatch
        if !menu.exists {
            XCTAssertTrue(words.waitForExistence(timeout:12))
            words.tap()
        }
        XCTAssertTrue(menu.waitForExistence(timeout:12),"missing vocabulary menu: "+app.debugDescription.prefix(3800))
        func vocabulary(_ name:String) {
            menu.tap()
            let item=app.descendants(matching:.any).matching(NSPredicate(format:"label ==[c] %@",name)).firstMatch
            XCTAssertTrue(item.waitForExistence(timeout:8))
            item.tap()
        }
        vocabulary("Common words")
        vocabulary("Q codes")
        XCTAssertTrue(start.waitForExistence(timeout:12))
        capture(label+"-q-ready")
        start.tap()
        let choices = app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@ AND NOT label CONTAINS %@", "Answer ", "concealed"))
        XCTAssertTrue(choices.firstMatch.waitForExistence(timeout:25))
        XCTAssertEqual(choices.count,4)
        capture(label+"-q-choose")
        let tiles = choices.allElementsBoundByIndex.map(\.frame)
        XCTAssertEqual(tiles[0].midY, tiles[1].midY, accuracy:2)
        XCTAssertEqual(tiles[2].midY, tiles[3].midY, accuracy:2)
        XCTAssertGreaterThan(tiles[2].minY, tiles[0].minY)
        XCTAssertTrue(app.frame.contains(app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Replay")).firstMatch.frame))
        choices.element(boundBy:0).tap()
        let next = app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Next")).firstMatch
        XCTAssertTrue(next.waitForExistence(timeout:15))
        let miss=app.staticTexts.matching(NSPredicate(format:"label ==[c] %@", "The word was")).firstMatch
        for _ in 0..<6 where !miss.exists {
            vocabulary("Common words")
            vocabulary("Q codes")
            XCTAssertTrue(start.waitForExistence(timeout:10))
            start.tap()
            XCTAssertTrue(choices.firstMatch.waitForExistence(timeout:15))
            choices.element(boundBy:0).tap()
            XCTAssertTrue(next.waitForExistence(timeout:12))
        }
        XCTAssertTrue(miss.exists)
        capture(label+"-q-miss")
        XCTAssertTrue(choices.allElementsBoundByIndex.allSatisfy { $0.label.uppercased().contains("Q") })
    }
    private func capture(_ name:String) {
        let a = XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        a.name=name
        a.lifetime = .keepAlways
        add(a)
    }
}
