import XCTest
final class GuidedFinale: XCTestCase {
    func testExact() { exercise("exact","com.tylerobinson.dit.exactspike") }
    func testPinned() { exercise("source","com.tylerobinson.dit") }
    private func exercise(_ label:String,_ bundle:String) {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:bundle)
        app.launch()
        let digit=app.buttons.matching(NSPredicate(format:"label == %@", "Type 0")).firstMatch
        let resume=app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Return to guided lesson")).firstMatch
        XCTAssertTrue(resume.waitForExistence(timeout:45),"a restored guided Listen starts on Practice")
        capture(label+"-return-to-lesson")
        resume.tap()
        if !digit.waitForExistence(timeout:20) {
            let ready=app.staticTexts["Ready to listen"]
            if ready.exists { app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Continue")).firstMatch.tap() }
        }
        XCTAssertTrue(digit.waitForExistence(timeout:10),"missing final seeded Listen prompt: "+app.debugDescription.prefix(3200))
        XCTAssertTrue(digit.isEnabled)
        capture(label+"-finale-before")
        digit.tap()
        let complete=app.staticTexts.matching(NSPredicate(format:"label ==[c] %@", "Course complete")).firstMatch
        XCTAssertTrue(complete.waitForExistence(timeout:12),"final correct digit should finish course: "+app.debugDescription.prefix(3200))
        capture(label+"-finale")
        let dismiss=app.buttons.matching(NSPredicate(format:"label ==[c] %@ OR label ==[c] %@", "Continue","Done")).firstMatch
        XCTAssertTrue(dismiss.exists)
        dismiss.tap()
        XCTAssertTrue(complete.waitForNonExistence(timeout:10))
        app.terminate();app.launch()
        XCTAssertFalse(complete.exists)
        XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout:20))
        capture(label+"-finale-relaunch")
    }
    private func capture(_ name:String) {
        let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)
    }
}
