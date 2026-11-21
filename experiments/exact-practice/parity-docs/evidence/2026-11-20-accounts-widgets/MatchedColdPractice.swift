import XCTest

final class MatchedColdPractice: XCTestCase {
    func testPinned() throws { try cold("pinned","com.tylerobinson.dit") }
    func testExact() throws { try cold("exact","com.tylerobinson.dit.exactspike") }
    func cold(_ label:String,_ id:String) throws {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:id)
        app.terminate()
        let start=ProcessInfo.processInfo.systemUptime
        app.launch()
        let key=app.buttons[label=="exact" ? "dit-native-morse-key" : "Tap for dot, hold for dah"]
        let settings=app.buttons["Settings"]
        XCTAssertTrue(key.waitForExistence(timeout:60),String(app.debugDescription.prefix(6000)))
        XCTAssertTrue(key.isHittable)
        XCTAssertEqual(key.label,"Tap for dot, hold for dah")
        let ready=ProcessInfo.processInfo.systemUptime-start
        let picture=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        picture.name=label+"-practice";picture.lifetime = .keepAlways;add(picture)
        print("COLD",label,ready,"label",key.label,"frame",key.frame,"settings",settings.exists)
        var issues=[String]()
        try app.performAccessibilityAudit(for:[.hitRegion,.sufficientElementDescription]) { issue in
            issues.append(issue.compactDescription+" "+(issue.element?.label ?? ""));return true
        }
        print("AUDIT",label,issues)
        let result=XCTAttachment(string:issues.joined(separator:"\n"));result.name=label+"-audit";result.lifetime = .keepAlways;add(result)
    }
}
