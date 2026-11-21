import XCTest

final class CustomScreen: XCTestCase {
    func testExact() { exercise("exact", "com.tylerobinson.dit.exactspike") }
    func testPinned() { exercise("source", "com.tylerobinson.dit") }

    private func exercise(_ label: String, _ bundle: String) {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: bundle)
        app.activate()
        let mode = app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@", "Mode:")).firstMatch
        XCTAssertTrue(mode.waitForExistence(timeout:25))
        if mode.label != "Mode: Listen" {
            mode.tap()
            let listen=app.buttons["Listen"]
            if !listen.waitForExistence(timeout:4) { mode.tap() }
            listen.tap()
        }
        func button(_ title:String)->XCUIElement { app.buttons.matching(NSPredicate(format:"label ==[c] %@", title)).firstMatch }
        let chars=app.descendants(matching:.any).matching(NSPredicate(format:"label ==[c] %@", "Characters")).firstMatch
        XCTAssertTrue(chars.waitForExistence(timeout:15))
        chars.tap()
        let use=button("Use custom")
        XCTAssertTrue(use.waitForExistence(timeout:12))
        use.tap()
        let edit=button("Edit text")
        if edit.exists { edit.tap() }
        let field=app.textViews.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout:10))
        capture(label+"-custom-editor")
        let empty = ["", "Paste a passage", "Source passage"]
        let prior=field.value as? String ?? ""
        XCTAssertTrue(empty.contains(prior) || prior=="ET E", "Unexpected existing text in the isolated test editor")
        if prior != "ET E" { field.tap(); field.typeText("ET E") }
        let save=button("Save")
        if !save.isHittable { app.swipeUp() }
        save.tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@", "4 chars")).firstMatch.waitForExistence(timeout:12))
        capture(label+"-custom-ready")
        button("Play").tap()
        let done=button("Done")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label ==[c] %@", "Compare your copy")).firstMatch.waitForExistence(timeout:20))
        capture(label+"-custom-reveal")
        done.tap()
        XCTAssertTrue(use.waitForExistence(timeout:15))
    }
    private func capture(_ name:String) {
        let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        a.name=name
        a.lifetime = .keepAlways
        add(a)
    }
}
