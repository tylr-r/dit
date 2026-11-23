// UIKit events cannot be constructed on the host. The two actual capture views
// receive these stand-ins; their key mapping, routing and Exact signal timers run unchanged.
import Foundation

private enum UIKeyboardHIDUsage { case keyboardSpacebar, keyboardLeftControl, keyboardRightControl, keyboardOpenBracket, keyboardCloseBracket, other }
private struct UIKey { let keyCode: UIKeyboardHIDUsage; let charactersIgnoringModifiers: String }
private final class UIPress: NSObject {
    let key: UIKey?
    init(_ code: UIKeyboardHIDUsage, _ text: String = "") { key = UIKey(keyCode:code, charactersIgnoringModifiers:text) }
}
private class UIEvent {}
private final class UIPressesEvent: UIEvent {}
private final class UITouch: NSObject {}
private final class DitWaveMeter { func attach(to: UIView?) {} }
private protocol UITextInput {}
private class UIView: NSObject {
    weak var window: UIWindow?
    var subviews: [UIView] = []
    static weak var responder: UIView?
    var isFirstResponder: Bool { UIView.responder === self }
    func resignFirstResponder() -> Bool {
        if isFirstResponder { UIView.responder = nil }
        return true
    }
    var canBecomeFirstResponder: Bool { false }
    func becomeFirstResponder() -> Bool {
        guard canBecomeFirstResponder else { return false }
        if !isFirstResponder { _ = UIView.responder?.resignFirstResponder(); UIView.responder = self }
        return true
    }
    func didMoveToWindow() {}
    func touchesBegan(_ t: Set<UITouch>, with event: UIEvent?) {}
    func touchesEnded(_ t: Set<UITouch>, with event: UIEvent?) {}
    func touchesCancelled(_ t: Set<UITouch>, with event: UIEvent?) {}
    func accessibilityActivate() -> Bool { false }
    var forwarded: [UIPress] = []
    func pressesBegan(_ p: Set<UIPress>, with event: UIPressesEvent?) { forwarded.append(contentsOf:p) }
    func pressesEnded(_ p: Set<UIPress>, with event: UIPressesEvent?) { forwarded.append(contentsOf:p) }
    func pressesCancelled(_ p: Set<UIPress>, with event: UIPressesEvent?) { forwarded.append(contentsOf:p) }
}

private final class UIWindow: UIView {}
private final class UITextField: UIView, UITextInput {
    static let textDidBeginEditingNotification = Notification.Name("testFieldBegan")
    static let textDidEndEditingNotification = Notification.Name("testFieldEnded")
    override var canBecomeFirstResponder: Bool { true }
}
private final class UITextView: UIView, UITextInput {
    static let textDidBeginEditingNotification = Notification.Name("testViewBegan")
    static let textDidEndEditingNotification = Notification.Name("testViewEnded")
    override var canBecomeFirstResponder: Bool { true }
}

private func verifyPaddleCapture() throws {
    func check(_ condition: Bool, _ message: String) throws {
        if !condition { throw NSError(domain:message, code:1) }
    }
    let left = UIPress(.keyboardLeftControl), right = UIPress(.keyboardRightControl)
    for unit in [100.0,40.0] {
        for original in [true,false] {
            let f = SignalFixture()
            defer { f.release() }
            f.key.unit = unit
            let source = HardwareMorseKeyCaptureView(), exact = DitInputView()
            source.onExternalMorseKey = { _ = f.key.key($0,down:$1 == "down") }
            exact.setEligibility(true, hardware:true)
            exact.key = { f.key.key($0,down:$1) }
            exact.interrupt = { f.key.cancel() }
            let view: UIView = original ? source : exact
            view.pressesBegan([left],with:nil)
            f.clock.advance(unit/2)
            view.pressesBegan([right],with:nil)
            view.pressesCancelled([left],with:nil)
            f.clock.advance(unit*2)
            view.pressesCancelled([right],with:nil)
            f.clock.advance(unit*4+250)
            try check(f.sequences == [".-"], "\(original ? "Pinned" : "Exact") cancelled paddle lost A at unit \(unit): \(f.sequences)")
            try check(f.times("tone+") == [0,unit*2] && f.times("tone-") == [unit,unit*5], "Incomplete dit/dah envelope")
        }
    }
    print("PASS individual cancellations preserve A and finish 1/3-unit tones at 12 and 30 WPM")
    for original in [true,false] {
        let source = HardwareMorseKeyCaptureView(), exact = DitInputView()
        var events = [String]()
        source.onExternalMorseKey = { events.append($0 + $1) }
        exact.setEligibility(true, hardware:true)
        exact.key = { events.append($0 + ($1 ? "down" : "up")); return true }
        let view: UIView = original ? source : exact
        let foreign = UIPress(.keyboardOpenBracket,"ü"), opening = UIPress(.other,"["), closing = UIPress(.other,"]")
        for key in [foreign,opening,closing] { view.pressesBegan([key],with:nil); view.pressesEnded([key],with:nil) }
        try check(events == [".down",".up","-down","-up"], "Bracket aliases used the wrong keyboard layout")
        try check(view.forwarded == [foreign,foreign], "Unmapped keys must reach the responder chain")
    }
    let f = SignalFixture(), view = DitInputView(), space = UIPress(.keyboardSpacebar," ")
    defer { f.release() }
    view.setEligibility(true, hardware:true)
    view.key = { f.key.key($0,down:$1) }
    view.interrupt = { f.key.cancel() }
    view.pressesBegan([space],with:nil)
    view.pressesCancelled([space],with:nil)
    f.clock.advance(500)
    try check(f.sequences.isEmpty && f.symbols.isEmpty, "Cancelling a straight key must discard its incomplete gesture")
    view.pressesBegan([left],with:nil)
    f.clock.advance(20)
    f.key.setSuspended(true)
    view.pressesCancelled([left],with:nil)
    f.clock.advance(500)
    try check(f.sequences.isEmpty && f.symbols.isEmpty, "Suspension must cancel pending paddle work")
    let editingSignal = SignalFixture(), editingKey = DitInputView(), window = UIWindow(), field = UITextField()
    defer { editingSignal.release() }
    editingKey.setEligibility(true, hardware:true)
    editingKey.key = { editingSignal.key.key($0,down:$1) }
    editingKey.interrupt = { editingSignal.key.cancel() }
    editingKey.cancelHardware = { editingSignal.key.cancel() }
    field.window = window; editingKey.window = window; window.subviews = [field, editingKey]
    _ = field.becomeFirstResponder()
    editingKey.didMoveToWindow()
    try check(field.isFirstResponder, "Morse key stole the active text editor on attachment")
    editingKey.pressesBegan([left,space],with:nil); editingKey.pressesEnded([left,space],with:nil)
    editingSignal.clock.advance(600)
    try check(editingSignal.sequences.isEmpty && editingKey.forwarded.count == 4, "focused typing entered Morse")
    let other = UIPress(.other,"x")
    editingKey.pressesBegan([other],with:nil); editingKey.pressesEnded([other],with:nil)
    try check(editingKey.forwarded.suffix(2) == [other,other], "ordinary typing must reach the responder chain")
    _ = field.resignFirstResponder()
    NotificationCenter.default.post(name:UITextField.textDidEndEditingNotification,object:field)
    RunLoop.main.run(until:Date().addingTimeInterval(0.01))
    try check(editingKey.isFirstResponder, "practice did not resume capture after editing")

    editingKey.pressesBegan([right],with:nil)
    editingSignal.clock.advance(20)
    _ = field.becomeFirstResponder()
    NotificationCenter.default.post(name:UITextField.textDidBeginEditingNotification,object:field)
    // Focus moves directly to a second editor; a late blur from the first cannot reclaim it.
    let multiline = UITextView()
    multiline.window = window; window.subviews.append(multiline)
    NotificationCenter.default.post(name:UITextField.textDidEndEditingNotification,object:field)
    _ = multiline.becomeFirstResponder()
    NotificationCenter.default.post(name:UITextView.textDidBeginEditingNotification,object:multiline)
    RunLoop.main.run(until:Date().addingTimeInterval(0.01))
    try check(multiline.isFirstResponder && !editingKey.canBecomeFirstResponder, "blur stole focus from the next editor")
    editingSignal.clock.advance(800)
    try check(editingSignal.symbols.isEmpty && editingSignal.times("tone-") == [620], "an interrupted hardware dah continued")
    _ = multiline.resignFirstResponder()
    NotificationCenter.default.post(name:UITextView.textDidEndEditingNotification,object:multiline)
    RunLoop.main.run(until:Date().addingTimeInterval(0.01))
    editingKey.pressesBegan([right],with:nil) // repeat from the interrupted press
    editingKey.pressesEnded([right],with:nil)
    editingKey.pressesBegan([left],with:nil); editingKey.pressesEnded([left],with:nil)
    editingSignal.clock.advance(800)
    try check(editingSignal.sequences == ["."], "stale hardware press replayed, or fresh practice failed")

    editingKey.pressesBegan([space],with:nil)
    editingKey.setEligibility(true,hardware:false)
    let touch = UITouch()
    editingKey.touchesBegan([touch],with:nil)
    editingKey.pressesEnded([space],with:nil) // cannot end the new touchscreen hold
    editingKey.pressesBegan([left,right],with:nil); editingKey.pressesEnded([left,right],with:nil)
    editingKey.agentKey(".",down:true); editingKey.agentKey(".",down:false)
    editingSignal.clock.advance(300)
    editingKey.touchesEnded([touch],with:nil)
    editingSignal.clock.advance(800)
    try check(editingSignal.sequences == [".","-"] && !editingKey.isFirstResponder, "tutorial intercepted a key or shortened a direct hold")
    try check(editingKey.accessibilityActivate(), "tutorial accessibility activation must be available")
    editingSignal.clock.advance(800)
    try check(editingSignal.sequences == [".","-","."], "accessibility activation did not produce one dit")
    print("PASS tutorial hardware exclusion with direct hold and accessibility activation; focused field and multiline editor, stale blur, cancelled repeat, fresh practice and unrelated keys")
    print("PASS layout-aware brackets, unmapped forwarding, straight-key cancellation and suspension")
}
