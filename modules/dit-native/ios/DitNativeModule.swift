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
  private var rampTargetAmplitude: Float = 0
  private var rampStep: Float = 0
  private var rampSamplesRemaining: Int = 0
  private var sampleRate: Double = 44_100
  private var format: AVAudioFormat?
  private var stateLock = os_unfair_lock_s()
  private let attackRampDurationSeconds: Double = 0.004
  private let releaseRampDurationSeconds: Double = 0.002
  private let preferredIOBufferDurationSeconds: TimeInterval = 0.0029

  private func withLock<T>(_ body: () -> T) -> T {
    os_unfair_lock_lock(&stateLock)
    defer { os_unfair_lock_unlock(&stateLock) }
    return body()
  }

  private func configureSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playback, options: [.mixWithOthers])
      // Keep realtime key-up/key-down sidetone control tighter by requesting a small I/O buffer.
      try session.setPreferredIOBufferDuration(preferredIOBufferDurationSeconds)
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
        (
          self.frequency,
          self.targetAmplitude
        )
      }
      let phaseIncrement = Float(2.0 * Double.pi * frequency / self.sampleRate)
      let attackRampSamples = max(
        1,
        Int(self.sampleRate * self.attackRampDurationSeconds)
      )
      let releaseRampSamples = max(
        1,
        Int(self.sampleRate * self.releaseRampDurationSeconds)
      )
      for frame in 0..<Int(frameCount) {
        if targetAmplitude != self.rampTargetAmplitude {
          let diff = targetAmplitude - self.currentAmplitude
          if diff == 0 {
            self.rampTargetAmplitude = targetAmplitude
            self.rampStep = 0
            self.rampSamplesRemaining = 0
          } else {
            let rampSamples = diff > 0 ? attackRampSamples : releaseRampSamples
            self.rampTargetAmplitude = targetAmplitude
            self.rampSamplesRemaining = rampSamples
            self.rampStep = diff / Float(rampSamples)
          }
        }

        if self.rampSamplesRemaining > 0 {
          self.currentAmplitude += self.rampStep
          self.rampSamplesRemaining -= 1
          if self.rampSamplesRemaining == 0 {
            self.currentAmplitude = self.rampTargetAmplitude
          }
        } else {
          self.currentAmplitude = self.rampTargetAmplitude
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

  func playMorseSequence(
    code: String,
    characterUnitMs: Double,
    effectiveUnitMs: Double,
    frequency: Double,
    volume: Double
  ) -> Bool {
    guard frequency > 0, characterUnitMs > 0, effectiveUnitMs > 0 else {
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
    let characterUnitFrames = max(1, Int((characterUnitMs / 1000) * sampleRate))
    let effectiveUnitFrames = max(1, Int((effectiveUnitMs / 1000) * sampleRate))
    let interCharacterGapFrames = max(characterUnitFrames * 3, effectiveUnitFrames * 3)
    let interWordGapFrames = max(characterUnitFrames * 7, effectiveUnitFrames * 7)
    var totalFrames = 0
    var segments: [(isTone: Bool, frames: Int)] = []
    let tokens = code.split(separator: " ", omittingEmptySubsequences: true)
    let filteredTokens = tokens.filter { token in
      token == "/" || token.contains { $0 == "." || $0 == "-" }
    }
    for tokenIndex in 0..<filteredTokens.count {
      let token = filteredTokens[tokenIndex]
      if token == "/" {
        segments.append((false, interWordGapFrames))
        totalFrames += interWordGapFrames
        continue
      }

      let symbols = Array(token).filter { $0 == "." || $0 == "-" }
      for symbolIndex in 0..<symbols.count {
        let symbol = symbols[symbolIndex]
        let duration = symbol == "." ? characterUnitFrames : characterUnitFrames * 3
        segments.append((true, duration))
        totalFrames += duration

        if symbolIndex < symbols.count - 1 {
          segments.append((false, characterUnitFrames))
          totalFrames += characterUnitFrames
        }
      }

      let hasNextToken = tokenIndex < filteredTokens.count - 1
      if hasNextToken {
        let nextToken = filteredTokens[tokenIndex + 1]
        let gapFrames = nextToken == "/" ? interWordGapFrames : interCharacterGapFrames
        segments.append((false, gapFrames))
        totalFrames += gapFrames
      }
    }

    // For single-letter listen playback, keep a trailing effective gap so spacing affects cadence.
    if !filteredTokens.isEmpty {
      segments.append((false, interCharacterGapFrames))
      totalFrames += interCharacterGapFrames
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

    AsyncFunction("playMorseSequence") { (code: String, characterUnitMs: Double, effectiveUnitMs: Double, frequency: Double, volume: Double) -> Bool in
      return self.toneGenerator.playMorseSequence(
        code: code,
        characterUnitMs: characterUnitMs,
        effectiveUnitMs: effectiveUnitMs,
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
