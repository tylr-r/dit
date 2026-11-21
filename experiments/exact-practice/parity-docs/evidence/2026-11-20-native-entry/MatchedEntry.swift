import XCTest

final class MatchedEntry: XCTestCase {
    func testPinnedDit() throws { try runEntry("source", "com.tylerobinson.dit") }
    func testExact() throws { try runEntry("exact", "com.tylerobinson.dit.exactspike") }

    // Both installations start signed out on a disposable Simulator. Changing
    // the reference's saved step would invalidate a first-launch comparison.
    private func runEntry(_ label: String, _ bundle: String) throws {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: bundle)
        app.activate()
        let stay = app.buttons["Stay signed out"]
        XCTAssertTrue(stay.waitForExistence(timeout: 90))
        attach(label + "-welcome")
        app.buttons["Sign in"].tap()
        let cancel = app.buttons["Cancel sign-in"]
        XCTAssertTrue(cancel.waitForExistence(timeout: 15))
        attach(label + "-account")
        cancel.tap()
        XCTAssertTrue(stay.waitForExistence(timeout: 15))
        stay.tap()
        let learn = app.buttons["Learn Morse from the basics"]
        XCTAssertTrue(learn.waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["Quick tour for experienced users"].exists)
        attach(label + "-profile")
        learn.tap()
        let titles = ["Real Morse fluency.", "No chart. Just listen.", "Real speed from day one."]
        let next = app.buttons.matching(NSPredicate(format: "label ==[c] %@", "Continue")).firstMatch
        for (index, title) in titles.enumerated() {
            XCTAssertTrue(app.staticTexts[title].waitForExistence(timeout: 20))
            XCTAssertTrue(next.exists)
            attach(label + "-slide-" + String(index + 1))
            next.tap()
        }
        XCTAssertTrue(app.staticTexts["Check your sound"].waitForExistence(timeout: 20))
        attach(label + "-sound")
        let testSound = app.buttons["Test sound"]
        XCTAssertTrue(testSound.exists)
        testSound.tap()
        XCTAssertTrue(next.waitForExistence(timeout: 10))
        if next.isEnabled {
            attach(label + "-sound-checked")
            next.tap()
            XCTAssertTrue(app.staticTexts["Meet the Morse key"].waitForExistence(timeout: 15))
            attach(label + "-tutorial")
        }
    }

    private func attach(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
