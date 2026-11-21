import XCTest
import Vision

// Dedicated 402 × 874 test devices. The visible cover sheet and wallpaper editor
// are the system UI; select only the intended installed app's rectangular entry.
final class RectangularWidget: XCTestCase {
    let home=XCUIApplication(bundleIdentifier:"com.apple.springboard")
    func point(_ x:CGFloat,_ y:CGFloat) -> XCUICoordinate {
        home.coordinate(withNormalizedOffset:CGVector(dx:x,dy:y))
    }
    func pause(_ seconds:Double) {RunLoop.current.run(until:Date().addingTimeInterval(seconds))}
    func shot(_ name:String) {
        let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)
    }
    func editorSlot() throws -> XCUICoordinate? {
        let request=VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        try VNImageRequestHandler(cgImage:XCUIScreen.main.screenshot().image.cgImage!).perform([request])
        guard let item=request.results?.first(where:{$0.topCandidates(1).first?.string.uppercased().contains("ADD WIDGETS")==true && $0.boundingBox.midY < 0.45}) else {return nil}
        return point(item.boundingBox.midX,1-item.boundingBox.midY)
    }
    func cover() {
        XCUIApplication(bundleIdentifier:"com.tylerobinson.dit.exactspike").activate()
        XCUIDevice.shared.press(.home)
        pause(2.5)
        point(0.27,0.001).press(forDuration:0.1,thenDragTo:point(0.28,0.82))
        pause(3)
        shot("before-customization")
    }
    func place(_ appName:String, _ extensionPrefix:String) throws {
        let placed=home.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@",extensionPrefix)).firstMatch
        if placed.exists && placed.isHittable {return}
        if let slot = try editorSlot() { slot.tap() }
        else {
            point(0.52,0.51).press(forDuration:1.5)
            let customize=home.buttons["posterboard-customize-button"]
            XCTAssertTrue(customize.waitForExistence(timeout:12));customize.tap()
            var slot:XCUICoordinate?
            for _ in 0..<10 {
                pause(1.2)
                slot=try editorSlot()
                if slot != nil {break}
            }
            if let slot {slot.tap()} else {point(0.65,0.79).tap()}
        }
        let candidates=home.cells.matching(NSPredicate(format:"label == %@",appName))
        XCTAssertTrue(candidates.firstMatch.waitForExistence(timeout:12))
        XCTAssertEqual(candidates.count,1,"Use the dedicated synthetic app or differently named test builds.")
        candidates.firstMatch.tap()
        let rect=home.buttons.matching(NSPredicate(format:"value CONTAINS[c] %@", "Rectangular")).firstMatch
        XCTAssertTrue(rect.waitForExistence(timeout:12));shot(appName+"-rectangular-gallery");rect.tap()
        let close=home.buttons.matching(NSPredicate(format:"label ==[c] %@", "close")).firstMatch
        if close.waitForExistence(timeout:4) {close.tap()}
        pause(1)
        point(0.5,0.45).press(forDuration:0.12,thenDragTo:point(0.5,0.95))
        pause(2)
        point(0.82,0.038).tap()
        pause(5)
        let current=home.cells.matching(NSPredicate(format:"identifier BEGINSWITH %@", "posterboard-posteruuid-")).firstMatch
        if current.exists && current.isHittable {current.tap()}
        XCTAssertTrue(placed.waitForExistence(timeout:15))
    }
    func testSourceAndExact() throws {
        continueAfterFailure=false
        if try editorSlot() == nil {cover()}
        try place("Dit","com.tylerobinson.dit.ExpoWidgetsTarget")
        shot("pinned-lock")
        try place("Dit Practice Spike","com.tylerobinson.dit.exactspike.widgets")
        let original=home.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@", "com.tylerobinson.dit.ExpoWidgetsTarget")).firstMatch
        let exact=home.buttons.matching(NSPredicate(format:"identifier BEGINSWITH %@", "com.tylerobinson.dit.exactspike.widgets")).firstMatch
        XCTAssertTrue(original.exists && exact.exists)
        print("RECT SOURCE",original.debugDescription)
        print("RECT EXACT",exact.debugDescription)
        shot("both-lock")
    }
}
