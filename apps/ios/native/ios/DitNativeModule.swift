import AVFoundation
import ExpoModulesCore
import UIKit

public class DitNativeModule: Module {
  private let engine = AVAudioEngine()
  private var sourceNode: AVAudioSourceNode?
  private var phase: Float = 0
  private var isToneActive = false
  private let frequency: Float = 640
  private let sampleRate: Float = Float(AVAudioSession.sharedInstance().sampleRate)

  public func definition() -> ModuleDefinition {
    Name("DitNative")
    AsyncFunction("startTone") { [weak self] (resolve, reject) in
      self?.startTone()
      resolve(())
    }
    AsyncFunction("stopTone") { [weak self] (resolve, reject) in
      self?.stopTone()
      resolve(())
    }
    AsyncFunction("playTone") { [weak self] (durationMs: Double, resolve, reject) in
      self?.playTone(durationMs: durationMs)
      resolve(())
    }
    AsyncFunction("triggerHaptic") { [weak self] (kind: String, resolve, reject) in
      self?.triggerHaptic(kind: kind)
      resolve(())
    }
  }

  private func ensureNode() {
    guard sourceNode == nil else {
      return
    }
    let format = AVAudioFormat(standardFormatWithSampleRate: Double(sampleRate), channels: 1)!
    sourceNode = AVAudioSourceNode { [weak self] _, _, frameCount, audioBufferList in
      guard let self = self else {
        return noErr
      }
      let ablPointer = UnsafeMutableAudioBufferListPointer(audioBufferList)
      for frame in 0 ..< Int(frameCount) {
        let sample = sinf(self.phase * 2 * .pi * self.frequency / self.sampleRate)
        self.phase += 1
        if self.phase >= self.sampleRate {
          self.phase -= self.sampleRate
        }
        let value = sample * 0.1
        for buffer in ablPointer {
          let pointer = buffer.mData!.assumingMemoryBound(to: Float.self)
          pointer[frame] = value
        }
      }
      return noErr
    }
    engine.attach(sourceNode!)
    engine.connect(sourceNode!, to: engine.mainMixerNode, format: format)
    try? engine.start()
  }

  private func startTone() {
    guard !isToneActive else {
      return
    }
    ensureNode()
    engine.mainMixerNode.outputVolume = 0.08
    isToneActive = true
  }

  private func stopTone() {
    guard isToneActive else {
      return
    }
    isToneActive = false
  }

  private func playTone(durationMs: Double) {
    startTone()
    DispatchQueue.main.asyncAfter(deadline: .now() + durationMs / 1000) { [weak self] in
      self?.stopTone()
    }
  }

  private func triggerHaptic(kind: String) {
    let generator: UIFeedbackGenerator
    switch kind {
    case "dash":
      generator = UIImpactFeedbackGenerator(style: .medium)
    case "success":
      generator = UINotificationFeedbackGenerator()
    default:
      generator = UIImpactFeedbackGenerator(style: .light)
    }
    generator.prepare()
    if let notification = generator as? UINotificationFeedbackGenerator {
      notification.notificationOccurred(.success)
      return
    }
    if let impact = generator as? UIImpactFeedbackGenerator {
      impact.impactOccurred()
    }
  }
}
