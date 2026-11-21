import XCTest

// Start from the verified small Exact widget picker on the synthetic 402 x 874
// 17 Pro. The beta hosts the carousel in a remote process outside the main AX tree.
final class WidgetPairs: XCTestCase {
    func testPreviewPairs() {
        let home=XCUIApplication(bundleIdentifier:"com.apple.springboard")
        func point(_ x:CGFloat,_ y:CGFloat)->XCUICoordinate {home.coordinate(withNormalizedOffset:CGVector(dx:x,dy:y))}
        func settle(){RunLoop.current.run(until:Date().addingTimeInterval(3))}
        func shot(_ name:String){settle();let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
        func medium(){point(0.75,0.57).press(forDuration:0.12,thenDragTo:point(0.20,0.57))}
        shot("exact-widget-small")
        medium();shot("exact-widget-medium")
        point(0.92,0.185).tap();settle()
        let search=home.searchFields["Search Widgets"]
        XCTAssertTrue(search.waitForExistence(timeout:10))
        if search.value as? String != "Dit" {search.tap();search.typeText("Dit")}
        let source=home.cells["Dit"]
        XCTAssertTrue(source.waitForExistence(timeout:10))
        source.tap()
        shot("source-widget-small")
        medium();shot("source-widget-medium")
        point(0.50,0.905).tap();settle()
        if home.buttons["Done"].waitForExistence(timeout:3) {home.buttons["Done"].tap()}
        shot("source-widget-home")
    }
}
