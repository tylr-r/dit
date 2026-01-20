import AVFoundation
import ExpoModulesCore
import UIKit

public final class DitNativeModule: Module {
  private let engine = AVAudioEngine()
  private var sourceNode: AVAudioSourceNode?
  private var phase: Float = 0
  private var isToneActive = false
  private var sampleRate: Float = 44_100
  private let frequency: Float = 640
  private let amplitude: Float = 0.1

  public func definition() -> ModuleDefinition {
    Name("DitNative")

    AsyncFunction("startTone") { [weak self] in
      self?.startTone()
    }
    .runOnQueue(.main)

    AsyncFunction("stopTone") { [weak self] in
      self?.stopTone()
    }
    .runOnQueue(.main)

    AsyncFunction("playTone") { [weak self] (durationMs: Double) in
      self?.playTone(durationMs: durationMs)
    }
    .runOnQueue(.main)

    AsyncFunction("triggerHaptic") { [weak self] (kind: String) in
      self?.triggerHaptic(kind: kind)
    }
    .runOnQueue(.main)
  }

  private func configureAudioSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playback, options: [.mixWithOthers])
      try session.setActive(true)
      sampleRate = Float(session.sampleRate)
    } catch {
      sampleRate = 44_100
    }
  }

  private func ensureNode() {
    guard sourceNode == nil else {
      return
    }
    configureAudioSession()
    let format = AVAudioFormat(standardFormatWithSampleRate: Double(sampleRate), channels: 1)!
    sourceNode = AVAudioSourceNode { [weak self] _, _, frameCount, audioBufferList in
      guard let self = self else {
        return noErr
      }
      let isActive = self.isToneActive
      let ablPointer = UnsafeMutableAudioBufferListPointer(audioBufferList)
      for frame in 0 ..< Int(frameCount) {
        let sample = sinf(self.phase * 2 * .pi * self.frequency / self.sampleRate)
        self.phase += 1
        if self.phase >= self.sampleRate {
          self.phase -= self.sampleRate
        }
        let value: Float = isActive ? sample * self.amplitude : 0
        for buffer in ablPointer {
          let pointer = buffer.mData!.assumingMemoryBound(to: Float.self)
          pointer[frame] = value
        }
      }
      return noErr
    }
    engine.attach(sourceNode!)
    engine.connect(sourceNode!, to: engine.mainMixerNode, format: format)
    engine.mainMixerNode.outputVolume = 1.0
    engine.prepare()
    try? engine.start()
  }

  private func startTone() {
    ensureNode()
    phase = 0
    isToneActive = true
  }

  private func stopTone() {
    isToneActive = false
  }

  private func playTone(durationMs: Double) {
    startTone()
    DispatchQueue.main.asyncAfter(deadline: .now() + durationMs / 1000) { [weak self] in
      self?.stopTone()
    }
  }

  private func triggerHaptic(kind: String) {
    switch kind {
    case "dash":
      let generator = UIImpactFeedbackGenerator(style: .medium)
      generator.prepare()
      generator.impactOccurred()
    case "success":
      let generator = UINotificationFeedbackGenerator()
      generator.prepare()
      generator.notificationOccurred(.success)
    default:
      let generator = UIImpactFeedbackGenerator(style: .light)
      generator.prepare()
      generator.impactOccurred()
    }
  }
}
