import Foundation

struct DitToneInterval: Equatable {
    let startMs: Double
    let endMs: Double

    static func decode(_ plan: [[Double]]) -> [Self]? {
        var intervals: [Self] = []
        var previousEnd = 0.0
        for pair in plan {
            guard pair.count == 2, pair[0].isFinite, pair[1].isFinite,
                  pair[0] >= previousEnd, pair[1] > pair[0] else { return nil }
            intervals.append(Self(startMs: pair[0], endMs: pair[1]))
            previousEnd = pair[1]
        }
        return intervals.isEmpty ? nil : intervals
    }
}

enum DitHapticPattern: Equatable {
    case held
    case playback([DitToneInterval])
}

protocol DitHapticPlayer {
    func start()
    func pause()
    func resume()
    func stop()
}

protocol DitHapticDriver {
    func prepare(_ pattern: DitHapticPattern) -> DitHapticPlayer?
}

#if canImport(CoreHaptics)
import CoreHaptics

extension DitHapticPattern {
    /// Shipped Dit uses continuous events at full intensity and 0.5 sharpness.
    func events() -> [CHHapticEvent] {
        let parameters = [CHHapticEventParameter(parameterID: .hapticIntensity, value: 1),
                          CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5)]
        func event(at start: Double, for duration: Double) -> CHHapticEvent {
            CHHapticEvent(eventType: .hapticContinuous, parameters: parameters,
                          relativeTime: start, duration: duration)
        }
        switch self {
        case .held: return [event(at: 0, for: 30)]
        case let .playback(intervals):
            return intervals.map { event(at: $0.startMs / 1000, for: ($0.endMs - $0.startMs) / 1000) }
        }
    }
}
#endif

#if os(iOS)
import os

private final class DitCoreHapticPlayer: DitHapticPlayer {
    var player: CHHapticPatternPlayer?
    init(_ player: CHHapticPatternPlayer) { self.player = player }
    func start() { try? player?.start(atTime: CHHapticTimeImmediate) }
    func pause() { try? (player as? CHHapticAdvancedPatternPlayer)?.pause(atTime: CHHapticTimeImmediate) }
    func resume() { try? (player as? CHHapticAdvancedPatternPlayer)?.resume(atTime: CHHapticTimeImmediate) }
    func stop() { try? player?.stop(atTime: CHHapticTimeImmediate); player = nil }
}

/// Main-thread player ownership. After an engine reset, only a new user input
/// or playback request can start a newly prepared pattern.
final class DitCoreHaptics: DitHapticDriver {
    private let supported = CHHapticEngine.capabilitiesForHardware().supportsHaptics
    private var engine: CHHapticEngine?
    private weak var lastPlayer: DitCoreHapticPlayer?
    private let resetCount = OSAllocatedUnfairLock(initialState: UInt(0))
    private var playerGeneration: UInt = 0

    func prepare(_ pattern: DitHapticPattern) -> DitHapticPlayer? {
        guard supported else { return nil }
        do {
            let engine: CHHapticEngine
            if let existing = self.engine {
                engine = existing
            } else {
                engine = try CHHapticEngine()
                engine.playsHapticsOnly = true
                engine.isAutoShutdownEnabled = true
                engine.resetHandler = { [weak self] in
                    guard let self else { return }
                    let generation = self.resetCount.withLock { count in
                        count += 1
                        return count
                    }
                    DispatchQueue.main.async { [weak self] in
                        guard let self, self.playerGeneration < generation else { return }
                        self.lastPlayer?.stop()
                    }
                }
                self.engine = engine
            }
            let generation = resetCount.withLock { $0 }
            try engine.start()
            let native = try CHHapticPattern(events: pattern.events(), parameters: [])
            let player: CHHapticPatternPlayer
            switch pattern {
            case .held: player = try engine.makePlayer(with: native)
            case .playback: player = try engine.makeAdvancedPlayer(with: native)
            }
            let handle = DitCoreHapticPlayer(player)
            playerGeneration = generation
            lastPlayer = handle
            return handle
        } catch {
            return nil
        }
    }
}
#endif
