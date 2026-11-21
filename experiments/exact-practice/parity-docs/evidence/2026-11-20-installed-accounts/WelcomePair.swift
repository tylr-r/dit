import XCTest

/// Use a disposable simulator with an untouched pinned welcome, light appearance and Large text.
final class WelcomePair: XCTestCase {
    func testColdWelcome() throws {
        continueAfterFailure = false
        for (name,id) in [("original","com.tylerobinson.dit"),("exact","com.tylerobinson.dit.exactspike"),
                          ("exact","com.tylerobinson.dit.exactspike"),("original","com.tylerobinson.dit")] {
            let app = XCUIApplication(bundleIdentifier:id)
            app.terminate()
            let start = ProcessInfo.processInfo.systemUptime
            app.launch()
            let sign = app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Sign in")).firstMatch
            let stay = app.buttons.matching(NSPredicate(format:"label ==[c] %@", "Stay signed out")).firstMatch
            XCTAssertTrue(sign.waitForExistence(timeout:45))
            XCTAssertTrue(stay.waitForExistence(timeout:10))
            XCTAssertTrue(sign.isHittable && stay.isHittable)
            let elapsed = ProcessInfo.processInfo.systemUptime - start
            print("WELCOME",name,elapsed,"sign",sign.frame,"stay",stay.frame)
            let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot())
            shot.name = name+"-welcome"; shot.lifetime = .keepAlways; add(shot)
            var findings = [String]()
            try app.performAccessibilityAudit(for:[.hitRegion,.sufficientElementDescription]) { issue in
                findings.append(issue.compactDescription+" "+(issue.element?.label ?? "")); return true
            }
            print("WELCOME AUDIT",name,findings)
            app.terminate()
        }
    }
}
