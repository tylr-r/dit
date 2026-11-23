import CoreGraphics
import Foundation

@main
struct WaveFeedbackCheck {
    static func main() {
        var failures = 0
        func expect(_ actual: Double, _ expected: Double, _ label: String) {
            if abs(actual - expected) > 0.000_001 {
                print("FAIL \(label): expected \(expected), got \(actual)")
                failures += 1
            }
        }

        var tint = DitWaveTint()
        var now = 0.0
        tint.set(graded: true, animated: true, at: now)
        now += 0.210
        expect(tint.opacity(at: now), 0.6125, "210 ms, cubic ease-out")
        tint.set(graded: true, animated: true, at: now)
        now += 0.210
        expect(tint.opacity(at: now), 0.7, "420 ms, graded tint ceiling")
        tint.set(graded: false, animated: true, at: now)
        now += 0.140
        expect(tint.opacity(at: now), 0.525, "140 ms, quadratic ease-in release")
        tint.set(graded: true, animated: true, at: now)
        expect(tint.opacity(at: now), 0.525, "interrupt without an opacity jump")
        now += 0.210
        expect(tint.opacity(at: now), 0.678125, "grade again from presentation opacity")
        tint.set(graded: false, animated: false, at: now)
        expect(tint.opacity(at: now), 0, "frozen idle")
        tint.set(graded: true, animated: false, at: now)
        expect(tint.opacity(at: now), 0.7, "frozen graded")
        tint.set(graded: false, animated: true, at: now)
        now += 0.280
        expect(tint.opacity(at: now), 0, "280 ms, clear")
        // Two fully overlapping strokes have the same composited tint as one.
        let context = CGContext(data: nil, width: 2, height: 1, bitsPerComponent: 8,
                                bytesPerRow: 2, space: CGColorSpaceCreateDeviceGray(),
                                bitmapInfo: CGImageAlphaInfo.none.rawValue)!
        context.setFillColor(gray: 0, alpha: 1)
        context.fill(CGRect(x: 0, y: 0, width: 2, height: 1))
        tint.set(graded: true, animated: false, at: now)
        tint.draw(in: context, at: now) {
            context.setShouldAntialias(false)
            context.setStrokeColor(gray: 1, alpha: 1)
            context.setLineWidth(1)
            context.strokeLineSegments(between: [CGPoint(x: 0, y: 0.5), CGPoint(x: 2, y: 0.5)])
            context.strokeLineSegments(between: [CGPoint(x: 1, y: 0.5), CGPoint(x: 2, y: 0.5)])
        }
        let pixels = context.data!.assumingMemoryBound(to: UInt8.self)
        guard (178...179).contains(pixels[0]), pixels[0] == pixels[1] else {
            print("FAIL tint pixels for one and two strokes: \(pixels[0]), \(pixels[1])")
            exit(1)
        }
        print("PASS offscreen one-stroke and overlap pixels: \(pixels[0]), \(pixels[1])")
        if failures > 0 { exit(1) }
        print("PASS eight Listen waveform transition samples")
    }
}
