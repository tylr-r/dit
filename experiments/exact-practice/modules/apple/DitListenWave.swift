#if os(iOS)
@preconcurrency import UIKit

/// A window samples only the sidetone associated with its own Dit session.
final class DitWaveMeter: NSObject {
    @MainActor static let windows = NSMapTable<UIWindow, DitWaveMeter>.weakToWeakObjects()
    var sounding: () -> Bool = { false }
    private weak var attached: UIWindow?

    @MainActor func attach(to window: UIWindow?) {
        if let attached, Self.windows.object(forKey: attached) === self {
            Self.windows.removeObject(forKey: attached)
        }
        attached = window
        if let window { Self.windows.setObject(self, forKey: window) }
    }
}

/// Character Listen's six symmetric traces use one carrier. Its envelope follows
/// audio-render activity. No letter, key sequence or answer is supplied to this view.
final class DitListenWave: ExactNativeInstance {
    private let wave = CharacterWaveView()
    override var view: ExactNativeView { wave }

    override func setProps(_ props: [String: String]) throws {
        wave.configure(speed: Double(props["letter-speed"] ?? "") ?? 12,
                       feedback: props["feedback"] ?? "", paused: props["wave-paused"] == "true")
    }
    override func destroy() { wave.stop() }
}

private final class CharacterWaveView: UIView {
    private var display: CADisplayLink?
    private var elapsed = 0.0
    private var energy = 0.12
    private var tint = 0.0
    private var lastFrame = 0.0
    private var speed = 12.0
    private var feedback = ""
    private var tintColorForAnswer = UIColor.systemGreen
    private var paused = true
    private var stopped = false
    private let colors = [UIColor(red:0.21,green:0.95,blue:0.63,alpha:0.35),
                          UIColor(red:1,green:0.56,blue:0.25,alpha:1), UIColor.white.withAlphaComponent(0.4)]

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        isUserInteractionEnabled = false
        contentMode = .redraw
        isAccessibilityElement = true
        accessibilityLabel = "Morse waveform"
        accessibilityTraits = .image
    }
    required init?(coder: NSCoder) { nil }

    func configure(speed: Double, feedback: String, paused: Bool) {
        guard self.speed != speed || self.feedback != feedback || self.paused != paused else { return }
        self.speed = max(10,min(30,speed))
        self.feedback = feedback
        if !feedback.isEmpty { tintColorForAnswer = feedback == "Correct" ? .systemGreen : .systemRed }
        self.paused = paused
        if paused { tint = feedback.isEmpty ? 0 : 1 }
        updateClock()
        setNeedsDisplay()
    }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        updateClock()
    }
    func stop() {
        stopped = true
        updateClock()
    }
    private func updateClock() {
        if paused || window == nil || stopped {
            display?.invalidate()
            display = nil
            lastFrame = 0
        } else if display == nil {
            let link = CADisplayLink(target:self, selector:#selector(tick(_:)))
            link.preferredFrameRateRange = CAFrameRateRange(minimum:15, maximum:30, preferred:30)
            link.add(to:.main, forMode:.common)
            display = link
        }
    }
    @objc private func tick(_ link: CADisplayLink) {
        let delta = lastFrame > 0 ? min(0.1, max(0,link.timestamp-lastFrame)) : 0
        lastFrame = link.timestamp
        elapsed += delta
        let on = window.flatMap { DitWaveMeter.windows.object(forKey:$0) }?.sounding() == true
        let target = on ? 1.0 : 0.12
        energy += (target-energy)*(1-exp(-delta/(target > energy ? 0.062 : 0.190)))
        tint = feedback.isEmpty ? max(0,tint-delta/0.28) : min(1,tint+delta/0.42)
        setNeedsDisplay()
    }
    override func draw(_ rect: CGRect) {
        guard bounds.width > 0, bounds.height > 0 else { return }
        let height = Double(bounds.height)
        let carrier = elapsed * 2 * Double.pi / max(1.4, (1.2/speed)*18)
        let amplitude = height*(0.028 + 0.165*(0.24+energy*0.76))
        for inverse in [true,false] {
            for lane in 0..<3 {
                let offset = Double(lane-1)
                let direction = (inverse ? [-1.0,1.0,1.0] : [1.0,-1.0,1.0])[lane]
                let path = UIBezierPath()
                path.lineWidth = lane == 1 ? 2.8 : 1.9
                path.lineCapStyle = .round
                for sample in 0...80 {
                    let t = Double(sample)/80
                    let envelope = 0.52 + sin(.pi*t)*0.48
                    let shift = sin(carrier*direction+t*2 * .pi*1.2+offset*0.9)
                    let y = height*(0.5+0.03*offset) + (inverse ? -1.0 : 1.0)*shift*amplitude*(lane == 1 ? 1 : 0.74)*envelope
                    let point = CGPoint(x:t*bounds.width, y:y)
                    if sample == 0 { path.move(to:point) } else { path.addLine(to:point) }
                }
                colors[lane].setStroke()
                path.stroke()
                if tint > 0 { tintColorForAnswer.withAlphaComponent(tint).setStroke(); path.stroke() }
            }
        }
    }
}
#endif
