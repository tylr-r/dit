import XCTest

final class GuidedAdvance: XCTestCase {
    func testExact() { reachListen("exact","com.tylerobinson.dit.exactspike") }
    func testPinned() { reachListen("source","com.tylerobinson.dit") }
    private func reachListen(_ label:String,_ bundle:String) {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:bundle)
        app.launch()
        let next=app.buttons.matching(NSPredicate(format:"label =[c] %@", "Continue")).firstMatch
        let key=app.buttons[label == "source" ? "Tap for dot, hold for dah" : "dit-native-morse-key"]
        for _ in 0..<24 {
            if next.exists && next.isHittable { break }
            XCTAssertTrue(key.waitForExistence(timeout:10))
            let e=app.staticTexts.matching(NSPredicate(format:"label == %@", "E")).firstMatch
            let t=app.staticTexts.matching(NSPredicate(format:"label == %@", "T")).firstMatch
            XCTAssertTrue(e.exists || t.exists)
            key.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:e.exists ? 0.06 : 0.55)
            RunLoop.current.run(until:Date().addingTimeInterval(2.2))
        }
        XCTAssertTrue(next.waitForExistence(timeout:10))
        XCTAssertTrue(app.staticTexts["Ready to listen"].exists)
        next.tap()
        XCTAssertTrue(next.waitForNonExistence(timeout:12))
        XCTAssertTrue(app.buttons["Type E"].waitForExistence(timeout:12))
        app.terminate()
        app.launch()
        let resume=app.buttons["Return to guided lesson"]
        XCTAssertTrue(resume.waitForExistence(timeout:30))
        // The accessibility tree becomes usable before Expo removes its splash.
        RunLoop.current.run(until:Date().addingTimeInterval(4))
        capture(label+"-pack1-return")
        resume.tap()
        let unlocked=app.staticTexts["New letters unlocked"]
        for letter in ["E","T","E","T","E","T"] {
            let answer=app.buttons["Type "+letter]
            XCTAssertTrue(answer.waitForExistence(timeout:12))
            let ready=XCTNSPredicateExpectation(predicate:NSPredicate(format:"enabled == true"),object:answer)
            XCTAssertEqual(XCTWaiter.wait(for:[ready],timeout:8),.completed)
            answer.tap()
            RunLoop.current.run(until:Date().addingTimeInterval(3.1))
            if unlocked.exists { break }
        }
        XCTAssertTrue(unlocked.waitForExistence(timeout:8),String(app.debugDescription.prefix(2600)))
        capture(label+"-first-unlock")
        next.tap()
        XCTAssertTrue(key.waitForExistence(timeout:12))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label ==[c] %@", "Pack 2")).firstMatch.exists)
        capture(label+"-pack2-teach")
        app.terminate();app.launch()
        XCTAssertTrue(key.waitForExistence(timeout:18))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label ==[c] %@", "Pack 2")).firstMatch.exists)
        RunLoop.current.run(until:Date().addingTimeInterval(4))
        capture(label+"-pack2-relaunch")
    }
    private func capture(_ name:String) {
        let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        a.name=name
        a.lifetime = .keepAlways
        add(a)
    }
}
