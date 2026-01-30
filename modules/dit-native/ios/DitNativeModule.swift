import AVFoundation
import ExpoModulesCore
import FirebaseAuth
import GoogleSignIn
import FirebaseCore
import os.lock

private final class ToneGenerator {
  private let engine = AVAudioEngine()
  private var sourceNode: AVAudioSourceNode?
  private let sequenceNode = AVAudioPlayerNode()
  private var phase: Float = 0
  private var frequency: Double = 440
  private var currentAmplitude: Float = 0
  private var targetAmplitude: Float = 0
  private var sampleRate: Double = 44_100
  private var format: AVAudioFormat?
  private var stateLock = os_unfair_lock_s()
  private let rampDurationSeconds: Double = 0.004

  private func withLock<T>(_ body: () -> T) -> T {
    os_unfair_lock_lock(&stateLock)
    defer { os_unfair_lock_unlock(&stateLock) }
    return body()
  }

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
    sampleRate = engine.outputNode.outputFormat(forBus: 0).sampleRate
    guard let format = AVAudioFormat(
      standardFormatWithSampleRate: sampleRate,
      channels: 1
    ) else {
      return false
    }
    sampleRate = format.sampleRate
    self.format = format

    let node = AVAudioSourceNode { [weak self] _, _, frameCount, audioBufferList in
      guard let self else { return noErr }
      let ablPointer = UnsafeMutableAudioBufferListPointer(audioBufferList)
      let (frequency, targetAmplitude) = self.withLock {
        (self.frequency, self.targetAmplitude)
      }
      let phaseIncrement = Float(2.0 * Double.pi * frequency / self.sampleRate)
      let rampSamples = max(1, Int(self.sampleRate * self.rampDurationSeconds))
      for frame in 0..<Int(frameCount) {
        if self.currentAmplitude != targetAmplitude {
          let diff = targetAmplitude - self.currentAmplitude
          let step = diff / Float(rampSamples)
          if abs(diff) <= abs(step) {
            self.currentAmplitude = targetAmplitude
          } else {
            self.currentAmplitude += step
          }
        }
        let sample = sin(self.phase) * self.currentAmplitude
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
    engine.attach(sequenceNode)
    engine.connect(node, to: engine.mainMixerNode, format: format)
    engine.connect(sequenceNode, to: engine.mainMixerNode, format: format)
    engine.prepare()
    sourceNode = node
    return true
  }

  private func startEngineIfNeeded() -> Bool {
    if engine.isRunning {
      return true
    }
    do {
      try engine.start()
    } catch {
      return false
    }
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
    let clampedVolume = Float(max(0, min(volume, 1)))
    withLock {
      self.frequency = frequency
      self.targetAmplitude = clampedVolume
    }
    engine.mainMixerNode.outputVolume = 1
    if !startEngineIfNeeded() {
      return false
    }
    return true
  }

  func stop() -> Bool {
    withLock {
      self.targetAmplitude = 0
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

  func playMorseSequence(code: String, unitMs: Double, frequency: Double, volume: Double) -> Bool {
    guard frequency > 0, unitMs > 0 else {
      return false
    }
    if !setupIfNeeded() {
      return false
    }
    configureSession()
    if !startEngineIfNeeded() {
      return false
    }
    _ = stop()
    guard let format else {
      return false
    }
    let unitFrames = max(1, Int((unitMs / 1000) * sampleRate))
    var totalFrames = 0
    var segments: [(isTone: Bool, frames: Int)] = []
    for symbol in code {
      if symbol != "." && symbol != "-" {
        continue
      }
      let duration = symbol == "." ? unitFrames : unitFrames * 3
      segments.append((true, duration))
      segments.append((false, unitFrames))
      totalFrames += duration + unitFrames
    }
    if totalFrames == 0 {
      return false
    }
    guard let buffer = AVAudioPCMBuffer(
      pcmFormat: format,
      frameCapacity: AVAudioFrameCount(totalFrames)
    ) else {
      return false
    }
    buffer.frameLength = AVAudioFrameCount(totalFrames)
    guard let channelData = buffer.floatChannelData?[0] else {
      return false
    }
    let clampedVolume = Float(max(0, min(volume, 1)))
    let phaseIncrement = Float(2.0 * Double.pi * frequency / sampleRate)
    let fadeFrames = max(1, Int(sampleRate * 0.003))
    var frameIndex = 0
    var localPhase: Float = 0
    for segment in segments {
      if segment.isTone {
        let toneFrames = segment.frames
        let ramp = min(fadeFrames, max(1, toneFrames / 2))
        for i in 0..<toneFrames {
          var envelope: Float = 1
          if ramp > 1 {
            if i < ramp {
              envelope = Float(i) / Float(ramp)
            } else if i >= toneFrames - ramp {
              envelope = Float(toneFrames - i - 1) / Float(ramp)
            }
          }
          channelData[frameIndex] = sin(localPhase) * clampedVolume * envelope
          localPhase += phaseIncrement
          if localPhase >= Float(2.0 * Double.pi) {
            localPhase -= Float(2.0 * Double.pi)
          }
          frameIndex += 1
        }
      } else {
        for _ in 0..<segment.frames {
          channelData[frameIndex] = 0
          localPhase += phaseIncrement
          if localPhase >= Float(2.0 * Double.pi) {
            localPhase -= Float(2.0 * Double.pi)
          }
          frameIndex += 1
        }
      }
    }
    sequenceNode.stop()
    sequenceNode.scheduleBuffer(buffer, at: nil, options: [.interrupts])
    if !sequenceNode.isPlaying {
      sequenceNode.play()
    }
    return true
  }

  func stopMorseSequence() -> Bool {
    if sequenceNode.isPlaying {
      sequenceNode.stop()
    }
    return true
  }
}

public final class DitNativeModule: Module {
  private let toneGenerator = ToneGenerator()

  private func ensureFirebaseConfigured(promise: Promise) -> FirebaseApp? {
    if let app = FirebaseApp.app() {
      return app
    }

    guard let filePath = Bundle.main.path(
      forResource: "GoogleService-Info",
      ofType: "plist"
    ) else {
      promise.reject(
        "ERR_FIREBASE_CONFIG",
        "GoogleService-Info.plist not found in app bundle"
      )
      return nil
    }

    guard let options = FirebaseOptions(contentsOfFile: filePath) else {
      promise.reject(
        "ERR_FIREBASE_CONFIG",
        "Could not load Firebase options from GoogleService-Info.plist"
      )
      return nil
    }

    FirebaseApp.configure(options: options)
    return FirebaseApp.app()
  }

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

    AsyncFunction("prepareToneEngine") { () -> Bool in
      return self.toneGenerator.start(frequency: 640, volume: 0)
    }

    AsyncFunction("playMorseSequence") { (code: String, unitMs: Double, frequency: Double, volume: Double) -> Bool in
      return self.toneGenerator.playMorseSequence(
        code: code,
        unitMs: unitMs,
        frequency: frequency,
        volume: volume
      )
    }

    AsyncFunction("stopMorseSequence") { () -> Bool in
      return self.toneGenerator.stopMorseSequence()
    }

    AsyncFunction("signInWithGoogle") { (promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self else {
          promise.reject("ERR_GOOGLE_SIGN_IN", "Module unavailable")
          return
        }

        guard let app = self.ensureFirebaseConfigured(promise: promise) else {
          return
        }

        guard let clientID = app.options.clientID else {
          promise.reject(
            "ERR_GOOGLE_SIGN_IN",
            "Missing Google Sign-In client ID"
          )
          return
        }

        let configuration = GIDConfiguration(clientID: clientID)
        if GIDSignIn.sharedInstance.configuration?.clientID != configuration.clientID {
          GIDSignIn.sharedInstance.configuration = configuration
        }

        guard let currentViewController = self.appContext?.utilities?.currentViewController() else {
          promise.reject("ERR_NO_VIEW_CONTROLLER", "Could not find current view controller")
          return
        }

        GIDSignIn.sharedInstance.signIn(withPresenting: currentViewController) { result, error in
          if let error = error {
            promise.reject("ERR_GOOGLE_SIGN_IN", error.localizedDescription)
            return
          }

          guard let user = result?.user,
                let idToken = user.idToken?.tokenString else {
            promise.reject("ERR_NO_TOKEN", "No ID token found in Google Sign-In result")
            return
          }
          
          promise.resolve([
            "idToken": idToken,
            "accessToken": user.accessToken.tokenString,
            "email": user.profile?.email ?? ""
          ])
        }
      }
    }
  }
}
