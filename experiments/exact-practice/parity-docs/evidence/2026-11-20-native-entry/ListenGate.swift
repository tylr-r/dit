import XCTest

final class ListenGate: XCTestCase {
    func testExactMixedPractice() { reachListen("exact","com.tylerobinson.dit.exactspike") }
    func testSourceMixedPractice() { reachListen("source","com.tylerobinson.dit") }
    private func reachListen(_ label:String,_ bundle:String) {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:bundle)
        app.activate()
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
        capture(label+"-listen-gate")
        next.tap()
        XCTAssertTrue(next.waitForNonExistence(timeout:15))
        RunLoop.current.run(until:Date().addingTimeInterval(1.5))
        capture(label+"-guided-listen")
        let tree=XCTAttachment(string:app.debugDescription)
        tree.name=label+"-listen-tree"
        tree.lifetime = .keepAlways
        add(tree)
    }
    private func capture(_ name:String) {
        let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        a.name=name
        a.lifetime = .keepAlways
        add(a)
    }
}
