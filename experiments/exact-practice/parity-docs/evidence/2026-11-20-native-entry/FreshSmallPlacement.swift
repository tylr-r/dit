import XCTest

final class FreshSmallPlacement: XCTestCase {
    func testFreshPlacement() {
        continueAfterFailure=false
        let home=XCUIApplication(bundleIdentifier:"com.apple.springboard")
        let app=XCUIApplication(bundleIdentifier:"com.tylerobinson.dit.exactspike")
        app.activate()
        XCUIDevice.shared.press(.home)
        let edit=home.buttons["Edit"]
        if !edit.waitForExistence(timeout:2) {
            let icon=home.icons["Dit"]
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
        let candidates=home.cells.matching(NSPredicate(format:"label == %@", "Dit"))
        let cell=candidates.firstMatch
        XCTAssertTrue(cell.waitForExistence(timeout:8))
        XCTAssertEqual(candidates.count,1,"Use a dedicated Simulator containing only the isolated Dit app")
        cell.tap()
        func point(_ x:CGFloat,_ y:CGFloat)->XCUICoordinate {home.coordinate(withNormalizedOffset:CGVector(dx:x,dy:y))}
        func shot(_ name:String) {
            RunLoop.current.run(until:Date().addingTimeInterval(3))
            let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot());a.name=name;a.lifetime = .keepAlways;self.add(a)
        }
        shot("fresh-small-gallery")
        point(0.50,0.905).tap()
        let done=home.buttons["Done"]
        if done.waitForExistence(timeout:7) { done.tap() }
        shot("fresh-small-placed")
        let tree=XCTAttachment(string:home.debugDescription);tree.name="fresh-small-home";tree.lifetime = .keepAlways;self.add(tree)
    }
}
