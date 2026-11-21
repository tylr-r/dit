import XCTest
import Vision

final class LiveWidget: XCTestCase {
    let home = XCUIApplication(bundleIdentifier:"com.apple.springboard")
    let app = XCUIApplication(bundleIdentifier:"com.tylerobinson.dit.exactspike")
    func pause(_ s:Double) { RunLoop.current.run(until:Date().addingTimeInterval(s)) }
    func receipt(_ name:String, _ screenshot:XCUIScreenshot) {
        let a = XCTAttachment(screenshot:screenshot); a.name=name; a.lifetime = .keepAlways; add(a)
    }
    func readHome() throws -> (Int?,XCUIScreenshot) {
        let pic=XCUIScreen.main.screenshot()
        let req=VNRecognizeTextRequest()
        req.recognitionLevel = .accurate
        req.usesLanguageCorrection = false
        try VNImageRequestHandler(cgImage:pic.image.cgImage!).perform([req])
        let lines=(req.results ?? []).compactMap{$0.topCandidates(1).first?.string}
        print("SpringBoard OCR",lines)
        for text in lines {
            let compact=text.replacingOccurrences(of:" ",with:"")
            if let range=compact.range(of:#"[0-9]+/15"#, options:.regularExpression) {
                return (Int(compact[range].split(separator:"/")[0]),pic)
            }
        }
        return (nil,pic)
    }
    func findWidget() throws -> (Int,XCUIScreenshot)? {
        for index in 0..<3 {
            let (value,pic)=try readHome()
            if let value {return (value,pic)}
            if index < 2 {home.swipeLeft();pause(0.7)}
        }
        return nil
    }
    func testColdAccessibility() throws {
        continueAfterFailure=false
        app.terminate()
        let start=ProcessInfo.processInfo.systemUptime
        app.launch()
        let settings=app.buttons["Settings"]
        XCTAssertTrue(settings.waitForExistence(timeout:45))
        let key=app.buttons["dit-native-morse-key"]
        XCTAssertTrue(key.waitForExistence(timeout:10) && key.isHittable)
        print("Cold foreground with Settings and hittable key",ProcessInfo.processInfo.systemUptime-start)
        receipt("practice-cold",XCUIScreen.main.screenshot())
        var issues=[String]()
        try app.performAccessibilityAudit(for:[.hitRegion,.sufficientElementDescription]) { issue in
            issues.append(issue.compactDescription+" "+(issue.element?.label ?? "")); return true
        }
        let report=XCTAttachment(string:issues.joined(separator:"\n")); report.name="practice-audit"; report.lifetime = .keepAlways; add(report)
        print("Practice accessibility audit findings",issues)
        settings.tap()
        let method=app.buttons["Learning method"]
        XCTAssertTrue(method.waitForExistence(timeout:10))
        XCTAssertTrue(method.isHittable)
    }
    func testEarnAndRefresh() throws {
        continueAfterFailure=false
        app.activate()
        XCUIDevice.shared.press(.home)
        pause(2)
        let (before,first)=try XCTUnwrap(findWidget())
        receipt("home-before",first)
        XCTAssertLessThan(before,15)
        app.terminate(); app.launch()
        let settings=app.buttons["Settings"]
        XCTAssertTrue(settings.waitForExistence(timeout:30))
        settings.tap()
        let method=app.buttons["Learning method"]
        if !method.waitForExistence(timeout:5) {settings.tap()}
        XCTAssertTrue(method.waitForExistence(timeout:8))
        method.tap()
        let open=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@", "Open practice mode")).firstMatch
        XCTAssertTrue(open.waitForExistence(timeout:8),String(app.debugDescription.prefix(9000))); open.tap()
        let own=app.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH[c] %@", "Pick your own")).firstMatch
        XCTAssertTrue(own.waitForExistence(timeout:8))
        own.tap()
        let choice=app.descendants(matching:.any).matching(identifier:"scope-letter-E").firstMatch
        XCTAssertTrue(choice.waitForExistence(timeout:8),String(app.debugDescription.prefix(5500)))
        if !choice.isSelected && choice.value as? String != "1" {choice.tap()}
        for letter in ["M","I"] {
            let previous=app.descendants(matching:.any).matching(identifier:"scope-letter-"+letter).firstMatch
            if previous.isSelected || previous.value as? String == "1" {previous.tap()}
        }
        app.buttons["Apply selection"].tap()
        let close=app.buttons["Close settings"]
        if close.waitForExistence(timeout:2) {close.tap()}
        settings.tap()
        let helpers=app.buttons["Toggle helper options"]
        for _ in 0..<5 where !helpers.isHittable {app.swipeUp()}
        let hint=app.switches["Show hints"]
        if !hint.exists {helpers.tap()}
        for control in ["Show hints","Show mnemonics"] {
            let option=app.switches[control]
            if option.value as? String == "1" {
                for _ in 0..<4 where !option.isHittable {app.swipeUp()}
                option.tap()
            }
        }
        close.tap()
        let key=app.buttons["dit-native-morse-key"]
        XCTAssertTrue(key.waitForExistence(timeout:8),String(app.debugDescription.prefix(5500)))
        XCTAssertTrue(app.staticTexts["E"].waitForExistence(timeout:4),String(app.debugDescription.prefix(5500)))
        let start=ProcessInfo.processInfo.systemUptime
        key.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.065)
        pause(1.5)
        app.buttons["Open progress"].tap()
        let today=app.staticTexts.matching(NSPredicate(format:"label CONTAINS[c] %@", "/ 15 today")).firstMatch
        XCTAssertTrue(today.waitForExistence(timeout:8))
        print("App progress",today.label)
        receipt("app-after",XCUIScreen.main.screenshot())
        XCUIDevice.shared.press(.home)
        pause(1)
        let (firstSeen,pic)=try XCTUnwrap(findWidget())
        var actual=firstSeen
        var last=pic
        while actual == before && ProcessInfo.processInfo.systemUptime - start < 70 {
            pause(2)
            let next=try readHome()
            actual=next.0 ?? -1
            last=next.1
        }
        receipt("home-after",last)
        print("Home goal",before,actual,"elapsed since key",ProcessInfo.processInfo.systemUptime-start)
        XCTAssertEqual(actual,before+1)
    }
}
