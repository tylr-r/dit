import XCTest

/// Compare two already placed rectangular widgets on the same synthetic Lock Screen.
final class PlacedGeometry: XCTestCase {
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")

    func testMatchingRows() throws {
        continueAfterFailure = false
        XCUIApplication(bundleIdentifier: "com.tylerobinson.dit.exactspike").activate()
        XCUIDevice.shared.press(.home)
        let top = springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.27, dy: 0.001))
        let bottom = springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.27, dy: 0.85))
        top.press(forDuration: 0.15, thenDragTo: bottom)
        let original = springboard.buttons["com.tylerobinson.dit.ExpoWidgetsTarget:DitProgress"]
        let exact = springboard.buttons["com.tylerobinson.dit.exactspike.widgets:DitProgress"]
        XCTAssertTrue(original.waitForExistence(timeout: 18))
        XCTAssertTrue(exact.waitForExistence(timeout: 18))
        let picture = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        picture.name = "placed-geometry"
        picture.lifetime = .keepAlways
        add(picture)
        func rows(_ widget: XCUIElement) throws -> [CGRect] {
            let texts = widget.staticTexts.allElementsBoundByIndex
            XCTAssertEqual(texts.count, 3)
            let origin = widget.frame.origin
            let frames = [texts[0], texts[2], widget.progressIndicators.firstMatch]
            return frames.map { $0.frame.offsetBy(dx: -origin.x, dy: -origin.y) }
        }
        let sourceRows = try rows(original)
        let exactRows = try rows(exact)
        print("LOCK GEOMETRY original", sourceRows, "Exact", exactRows)
        for (left, right) in zip(sourceRows, exactRows) {
            XCTAssertEqual(left.minY, right.minY, accuracy: 1)
            XCTAssertEqual(left.minX, right.minX, accuracy: 1)
        }
    }
}
