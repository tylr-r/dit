import CoreGraphics

/// Display energy for either a rendered passage or the manual sidetone.
struct DitWaveEnvelope {
    private(set) var energy = 0.12

    mutating func advance(level: Double, seconds: Double) {
        let target = 0.12 + level * (1 - 0.12)
        let timeConstant = target > energy ? 0.062 : 0.190
        energy += (target - energy) * (1 - exp(-seconds / timeConstant))
    }
}

/// The six feedback strokes share one opacity, as in the shipped ListenSineWave overlay.
struct DitWaveTint {
    private var startOpacity = 0.0
    private var target = 0.0
    private var began = 0.0

    func opacity(at time: Double) -> Double {
        let rising = target > startOpacity
        let progress = min(1, max(0, (time - began) / (rising ? 0.420 : 0.280)))
        let remaining = 1 - progress
        let eased = rising ? 1 - remaining * remaining * remaining : progress * progress
        return startOpacity + (target - startOpacity) * eased
    }

    mutating func set(graded: Bool, animated: Bool, at time: Double) {
        let next = graded ? 0.7 : 0
        guard next != target || !animated else { return }
        startOpacity = animated ? opacity(at: time) : next
        target = next
        began = time
    }

    func draw(in context: CGContext, at time: Double, strokes: () -> Void) {
        let alpha = opacity(at: time)
        guard alpha > 0 else { return }
        context.saveGState()
        context.setAlpha(alpha)
        context.beginTransparencyLayer(auxiliaryInfo: nil)
        strokes()
        context.endTransparencyLayer()
        context.restoreGState()
    }
}

#if os(iOS)
@preconcurrency import UIKit

/// A window samples the rendered audio level of its own Dit session.
final class DitWaveMeter: NSObject {
    @MainActor static let windows = NSMapTable<UIWindow, DitWaveMeter>.weakToWeakObjects()
    var level: () -> Double = { 0 }
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
    private var envelope = DitWaveEnvelope()
    private var tint = DitWaveTint()
    private var lastFrame = 0.0
    private var speed = 12.0
    private var feedback = ""
    // sRGB components of the shipped feedback, wave accent and primary40 HSL tokens.
    private static let success = UIColor(red: 0.2104, green: 0.9496, blue: 0.62928, alpha: 1)
    private static let error = UIColor(red: 1, green: 0.42, blue: 0.42, alpha: 1)
    private var paused = true
    private var stopped = false
    private let colors = [
        CharacterWaveView.success.withAlphaComponent(0.35),
        UIColor(red: 1, green: 0.58, blue: 0.30, alpha: 1),
        UIColor(red: 0.9787, green: 0.96826, blue: 0.9613, alpha: 0.4),
    ]

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
        self.paused = paused
        tint.set(graded: !feedback.isEmpty, animated: !paused, at: CACurrentMediaTime())
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
        let level = window.flatMap { DitWaveMeter.windows.object(forKey:$0) }?.level() ?? 0
        envelope.advance(level: level, seconds: delta)
        setNeedsDisplay()
    }
    override func draw(_ rect: CGRect) {
        guard bounds.width > 0, bounds.height > 0, let context = UIGraphicsGetCurrentContext() else { return }
        var paths: [UIBezierPath] = []
        paths.reserveCapacity(6)
        let height = Double(bounds.height)
        let carrier = elapsed * 2 * Double.pi / max(1.4, (1.2/speed)*18)
        let amplitude = height*(0.028 + 0.165*(0.24+envelope.energy*0.76))
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
                paths.append(path)
            }
        }
        tint.draw(in: context, at: CACurrentMediaTime()) {
            (feedback.isEmpty || feedback == "Correct" ? Self.success : Self.error).setStroke()
            for path in paths { path.stroke() }
        }
    }
}
#endif
