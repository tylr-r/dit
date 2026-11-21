import XCTest

final class PackGate: XCTestCase {
    func testShippedTeachGate() { reachGate("source","com.tylerobinson.dit") }
    func testExactTeachGate() { reachGate("exact","com.tylerobinson.dit.exactspike") }
    private func reachGate(_ label:String,_ bundle:String) {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:bundle)
        app.activate()
        let source=label=="source"
        if source && app.buttons["Increase tone pitch"].isHittable {
            app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.065)).tap()
        }
        let key=app.buttons[source ? "Tap for dot, hold for dah" : "dit-native-morse-key"]
        let next=app.buttons.matching(NSPredicate(format:"label =[c] %@", "Continue")).firstMatch
        for _ in 0..<10 {
            if next.exists && next.isHittable { break }
            XCTAssertTrue(key.waitForExistence(timeout:10))
            let e=app.staticTexts.matching(NSPredicate(format:"label == %@", "E")).firstMatch
            let t=app.staticTexts.matching(NSPredicate(format:"label == %@", "T")).firstMatch
            XCTAssertTrue(e.exists || t.exists)
            if e.exists && app.staticTexts["1 remaining"].exists { capture(label+"-one-remaining") }
            key.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:e.exists ? 0.06 : 0.55)
            RunLoop.current.run(until:Date().addingTimeInterval(2.1))
        }
        XCTAssertTrue(next.waitForExistence(timeout:10))
        capture(label+"-teach-gate")
        let header=app.staticTexts.matching(NSPredicate(format:"label =[c] %@", "Next up")).firstMatch
        XCTAssertTrue(header.exists)
        XCTAssertTrue(app.staticTexts["Practice in mixed order."].exists)
    }
    private func capture(_ name:String) {
        let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        a.name=name
        a.lifetime = .keepAlways
        add(a)
    }
}
