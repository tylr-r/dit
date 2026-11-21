import XCTest

final class GuidedRetry: XCTestCase {
    func testExact() { exercise("exact","com.tylerobinson.dit.exactspike") }
    func testPinned() { exercise("source","com.tylerobinson.dit") }

    private func exercise(_ label:String,_ bundle:String) {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:bundle)
        app.launch()
        let e=app.buttons.matching(NSPredicate(format:"label == %@", "Type E")).firstMatch
        let next=app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Continue")).firstMatch
        let gate=app.staticTexts.matching(NSPredicate(format:"label ==[c] %@", "Keep going")).firstMatch
        let resume=app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Return to guided lesson")).firstMatch
        if resume.waitForExistence(timeout:4) {
            capture(label+"-return-to-lesson")
            resume.tap()
        }
        if next.waitForExistence(timeout:3) && app.staticTexts["Ready to listen"].exists { next.tap() }
        for _ in 0..<7 {
            if gate.exists { break }
            XCTAssertTrue(e.waitForExistence(timeout:15),"resume pack 1 Listen: "+app.debugDescription.prefix(2500))
            let enabled=NSPredicate(format:"enabled == true")
            let usable=XCTNSPredicateExpectation(predicate:enabled,object:e)
            XCTAssertEqual(XCTWaiter.wait(for:[usable],timeout:8),.completed)
            e.tap()
            RunLoop.current.run(until:Date().addingTimeInterval(3.5))
        }
        XCTAssertTrue(gate.waitForExistence(timeout:10))
        XCTAssertTrue(app.staticTexts["One more practice round before new letters."].exists)
        capture(label+"-retry-gate")
        next.tap()
        let key=app.buttons[label=="source" ? "Tap for dot, hold for dah" : "dit-native-morse-key"]
        XCTAssertTrue(key.waitForExistence(timeout:10))
        capture(label+"-retry-practice")
    }
    private func capture(_ name:String) {
        let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        shot.name=name
        shot.lifetime = .keepAlways
        add(shot)
    }
}
