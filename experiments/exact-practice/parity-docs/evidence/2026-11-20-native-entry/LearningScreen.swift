import XCTest
final class LearningScreen: XCTestCase {
    func testExact() { exercise("exact", "com.tylerobinson.dit.exactspike") }
    func testPinned() { exercise("source", "com.tylerobinson.dit") }
    private func exercise(_ label:String, _ bundle:String) {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:bundle)
        // Reference is a transient overlay. Relaunch only this synthetic app.
        app.terminate()
        app.launch()
        let settings=app.buttons["Settings"]
        XCTAssertTrue(settings.waitForExistence(timeout:50))
        let method=app.buttons["Learning method"]
        settings.tap()
        if !method.waitForExistence(timeout:5) { settings.tap() }
        XCTAssertTrue(method.waitForExistence(timeout:15))
        method.tap()
        let item=app.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH[c] %@", "Pick your own")).firstMatch
        XCTAssertTrue(item.waitForExistence(timeout:12))
        capture(label+"-learning-open")
        item.tap()
        let letter=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@ OR label == %@", "Q", "Toggle Q")).firstMatch
        XCTAssertTrue(letter.waitForExistence(timeout:8))
        capture(label+"-learning-picker")
        guard label == "exact" else { return }
        let back=app.buttons["Back to modes"]
        let apply=app.buttons["Apply selection"]
        XCTAssertTrue(back.exists && apply.exists)
        let original=letter.value as? String
        letter.tap()
        XCTAssertNotEqual(original,letter.value as? String)
        letter.tap()
        XCTAssertEqual(original,letter.value as? String)
        back.tap()
        let course=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@", "Course mode")).firstMatch
        course.tap()
        let packs=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@", "Pack "))
        XCTAssertTrue(packs.firstMatch.waitForExistence(timeout:10))
        XCTAssertEqual(packs.count,14)
        capture(label+"-learning-course")
        app.descendants(matching:.any).matching(NSPredicate(format:"label == %@", "Open practice mode")).firstMatch.tap()
        app.buttons["Done"].tap()
    }
    func testPinnedCourseFromPicker() {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:"com.tylerobinson.dit")
        app.activate()
        let back=app.buttons["Back to modes"]
        if !back.waitForExistence(timeout:5) {
            let item=app.buttons["Learning method"]
            if !item.exists { app.buttons["Settings"].tap() }
            item.tap()
        } else { back.tap() }
        let course=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@", "Course mode")).firstMatch
        course.tap()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@", "Pack 1, letters E T")).firstMatch.waitForExistence(timeout:10))
        capture("source-learning-course")
        app.descendants(matching:.any).matching(NSPredicate(format:"label == %@", "Open practice mode")).firstMatch.tap()
        app.buttons["Done"].tap()
    }
    func testPracticeControls() {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:"com.tylerobinson.dit.exactspike")
        app.terminate()
        app.launch()
        let open=app.buttons["Settings"]
        XCTAssertTrue(open.waitForExistence(timeout:30))
        open.tap()
        let expand=app.buttons["Toggle practice settings"]
        if expand.waitForExistence(timeout:2) { expand.tap() }
        let recovery=app.switches["Immediate flow recovery"]
        let review=app.switches["Review misses later"]
        let sequential=app.switches["Sequential order"]
        XCTAssertTrue(recovery.waitForExistence(timeout:8))
        XCTAssertTrue(sequential.exists && review.exists)
        for _ in 0..<5 where !review.isHittable { app.swipeUp() }
        let initial=recovery.value as? String
        if initial=="0" { recovery.tap() }
        XCTAssertTrue(review.isEnabled)
        recovery.tap()
        XCTAssertFalse(review.isEnabled)
        capture("exact-practice-controls")
        if initial=="1" { recovery.tap() }
        XCTAssertEqual(recovery.value as? String,initial)
    }
    func testCancelAppReset() {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:"com.tylerobinson.dit.exactspike")
        app.terminate()
        app.launch()
        let gear=app.buttons["Settings"]
        XCTAssertTrue(gear.waitForExistence(timeout:40))
        gear.tap()
        let reset=app.buttons["Reset app"]
        XCTAssertTrue(reset.waitForExistence(timeout:12))
        for _ in 0..<7 where !reset.isHittable { app.swipeUp() }
        reset.tap()
        let prompt=app.alerts["Reset App?"]
        XCTAssertTrue(prompt.waitForExistence(timeout:10))
        XCTAssertTrue(prompt.buttons["Cancel"].exists && prompt.buttons["Reset App"].exists)
        capture("exact-settings-reset-cancel")
        prompt.buttons["Cancel"].tap()
        XCTAssertFalse(prompt.exists)
        let close=app.buttons["Close settings"]
        XCTAssertTrue(close.exists)
        close.tap()
        XCTAssertTrue(gear.waitForExistence(timeout:12))
    }
    private func capture(_ name:String) {
        let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        shot.name=name;shot.lifetime = .keepAlways;add(shot)
    }
}
