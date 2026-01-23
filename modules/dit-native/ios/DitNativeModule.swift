import AVFoundation
import ExpoModulesCore

private final class ToneGenerator {
  private let engine = AVAudioEngine()
  private var sourceNode: AVAudioSourceNode?
  private var phase: Float = 0
  private var frequency: Double = 440
  private var amplitude: Float = 0
  private var sampleRate: Double = 44_100

  private func configureSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playback, options: [.mixWithOthers])
      try session.setActive(true)
    } catch {
      // No-op: fall back to system audio behavior.
    }
  }

  private func setupIfNeeded() -> Bool {
    if sourceNode != nil {
      return true
    }
    guard let format = AVAudioFormat(
      standardFormatWithSampleRate: sampleRate,
      channels: 1
    ) else {
      return false
    }
    sampleRate = format.sampleRate

    let node = AVAudioSourceNode { [weak self] _, _, frameCount, audioBufferList in
      guard let self else { return noErr }
      let ablPointer = UnsafeMutableAudioBufferListPointer(audioBufferList)
      let phaseIncrement = Float(2.0 * Double.pi * self.frequency / self.sampleRate)
      for frame in 0..<Int(frameCount) {
        let sample = sin(self.phase) * self.amplitude
        self.phase += phaseIncrement
        if self.phase >= Float(2.0 * Double.pi) {
          self.phase -= Float(2.0 * Double.pi)
        }
        for buffer in ablPointer {
          let pointer = buffer.mData?.assumingMemoryBound(to: Float.self)
          pointer?[frame] = sample
        }
      }
      return noErr
    }

    engine.attach(node)
    engine.connect(node, to: engine.mainMixerNode, format: format)
    engine.prepare()
    sourceNode = node
    return true
  }

  func start(frequency: Double, volume: Double) -> Bool {
    guard frequency > 0 else {
      return false
    }
    if !setupIfNeeded() {
      return false
    }
    configureSession()
    self.frequency = frequency
    amplitude = Float(max(0, min(volume, 1)))
    engine.mainMixerNode.outputVolume = 1
    if !engine.isRunning {
      do {
        try engine.start()
      } catch {
        return false
      }
    }
    return true
  }

  func stop() -> Bool {
    amplitude = 0
    engine.mainMixerNode.outputVolume = 0
    if engine.isRunning {
      engine.pause()
    }
    return true
  }

  func play(frequency: Double, durationMs: Double, volume: Double) -> Bool {
    if !start(frequency: frequency, volume: volume) {
      return false
    }
    let duration = max(durationMs, 0) / 1000
    DispatchQueue.main.asyncAfter(deadline: .now() + duration) { [weak self] in
      _ = self?.stop()
    }
    return true
  }
}

public final class DitNativeModule: Module {
  private let toneGenerator = ToneGenerator()

  public func definition() -> ModuleDefinition {
    Name("DitNative")

    Function("getHello") {
      return "Dit native module ready"
    }

    AsyncFunction("triggerHaptics") { (_ pattern: [Int]) -> Bool in
      return false
    }

    AsyncFunction("startTone") { (frequency: Double, volume: Double) -> Bool in
      return self.toneGenerator.start(frequency: frequency, volume: volume)
    }

    AsyncFunction("stopTone") { () -> Bool in
      return self.toneGenerator.stop()
    }

    AsyncFunction("playTone") { (frequency: Double, durationMs: Double, volume: Double) -> Bool in
      return self.toneGenerator.play(
        frequency: frequency,
        durationMs: durationMs,
        volume: volume
      )
    }
  }
}
