import XCTest

final class WidgetProgress: XCTestCase {
    func testPracticeContribution() {
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:"com.tylerobinson.dit.exactspike")
        app.launch()
        let settings=app.buttons["Settings"]
        XCTAssertTrue(settings.waitForExistence(timeout:30))
        settings.tap()
        let method=app.buttons["Learning method"]
        if !method.waitForExistence(timeout:5) { settings.tap() }
        XCTAssertTrue(method.waitForExistence(timeout:10))
        method.tap()
        let own=app.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH[c] %@", "Pick your own")).firstMatch
        XCTAssertTrue(own.waitForExistence(timeout:8))
        own.tap()
        let toggle=app.switches["scope-letter-E"]
        XCTAssertTrue(toggle.waitForExistence(timeout:8))
        toggle.tap()
        app.buttons["Apply selection"].tap()
        let close=app.buttons["Close settings"]
        if close.waitForExistence(timeout:2) { close.tap() }
        let target=app.staticTexts["E"]
        XCTAssertTrue(target.waitForExistence(timeout:10))
        let key=app.buttons["dit-native-morse-key"]
        XCTAssertTrue(key.isHittable)
        key.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.065)
        RunLoop.current.run(until:Date().addingTimeInterval(2.5))
        app.buttons["Open progress"].tap()
        let today=app.staticTexts.matching(NSPredicate(format:"label CONTAINS[c] %@", "/ 15 today")).firstMatch
        XCTAssertTrue(today.waitForExistence(timeout:6),String(app.debugDescription.prefix(3200)))
        let picture=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
        picture.name="app-progress-published";picture.lifetime = .keepAlways;add(picture)
    }
}

final class RevisedWidgetGallery: XCTestCase {
    func testUpdatedSmallAndMedium() {
        continueAfterFailure=false
        let home=XCUIApplication(bundleIdentifier:"com.apple.springboard")
        let app=XCUIApplication(bundleIdentifier:"com.tylerobinson.dit.exactspike")
        app.activate()
        XCUIDevice.shared.press(.home)
        let edit=home.buttons["Edit"]
        if !edit.waitForExistence(timeout:2) {
            let icon=home.icons["Dit Practice Spike"]
            if !icon.isHittable { home.swipeLeft() }
            XCTAssertTrue(icon.waitForExistence(timeout:8))
            icon.press(forDuration:1.2)
            let arrange=home.descendants(matching:.any).matching(NSPredicate(format:"label ==[c] %@", "Edit Home Screen")).firstMatch
            XCTAssertTrue(arrange.waitForExistence(timeout:8))
            arrange.tap()
        }
        XCTAssertTrue(edit.waitForExistence(timeout:8));edit.tap()
        let add=home.buttons.matching(NSPredicate(format:"label BEGINSWITH[c] %@", "Add Widget")).firstMatch
        XCTAssertTrue(add.waitForExistence(timeout:8));add.tap()
        let search=home.searchFields["Search Widgets"]
        XCTAssertTrue(search.waitForExistence(timeout:12))
        search.tap();search.typeText("Dit")
        let cell=home.cells["Dit Practice Spike"]
        XCTAssertTrue(cell.waitForExistence(timeout:8))
        cell.tap()
        func point(_ x:CGFloat,_ y:CGFloat)->XCUICoordinate {home.coordinate(withNormalizedOffset:CGVector(dx:x,dy:y))}
        func shot(_ name:String) {
            RunLoop.current.run(until:Date().addingTimeInterval(3))
            let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot());a.name=name;a.lifetime = .keepAlways;self.add(a)
        }
        shot("exact-widget-small-updated")
        point(0.75,0.57).press(forDuration:0.12,thenDragTo:point(0.20,0.57))
        shot("exact-widget-medium-updated")
        point(0.50,0.905).tap()
        let done=home.buttons["Done"]
        if done.waitForExistence(timeout:7) { done.tap() }
        shot("exact-widget-home-published")
    }
}
