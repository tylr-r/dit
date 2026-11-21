import XCTest

final class MixedPractice: XCTestCase {
    func testExactContinue() { resume("exact","com.tylerobinson.dit.exactspike") }
    func testSourceContinue() { resume("source","com.tylerobinson.dit") }
    private func resume(_ label:String,_ bundle:String) {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:bundle)
        app.activate()
        let next=app.buttons.matching(NSPredicate(format:"label =[c] %@", "Continue")).firstMatch
        XCTAssertTrue(next.waitForExistence(timeout:15))
        next.tap()
        XCTAssertTrue(next.waitForNonExistence(timeout:15))
        let play=app.buttons["Play target character"]
        XCTAssertTrue(play.waitForExistence(timeout:10))
        XCTAssertTrue(play.isHittable)
        let key=app.buttons[label=="exact" ? "dit-native-morse-key" : "Tap for dot, hold for dah"]
        XCTAssertTrue(key.isHittable)
        let img=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        img.name=label+"-mixed"
        img.lifetime = .keepAlways
        add(img)
    }
}
