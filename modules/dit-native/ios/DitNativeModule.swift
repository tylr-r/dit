import AVFoundation
import AuthenticationServices
import CoreHaptics
import CryptoKit
import ExpoModulesCore
import FirebaseAuth
import GoogleSignIn
import FirebaseCore
import os.lock
import Security
import UIKit

private let externalMorseKeyEventName = "onExternalMorseKey"

private final class HardwareMorseKeyCaptureView: UIView {
  private var activeKeyCodes = Set<UIKeyboardHIDUsage>()
  var onExternalMorseKey: ((String, String) -> Void)?

  override var canBecomeFirstResponder: Bool {
    true
  }

  override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
    var unhandled = Set<UIPress>()
    for press in presses {
      guard let key = press.key, let symbol = morseSymbol(for: key) else {
        unhandled.insert(press)
        continue
      }
      guard !activeKeyCodes.contains(key.keyCode) else {
        continue
      }
      activeKeyCodes.insert(key.keyCode)
      onExternalMorseKey?(symbol, "down")
    }
    if !unhandled.isEmpty {
      super.pressesBegan(unhandled, with: event)
    }
  }

  override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
    var unhandled = Set<UIPress>()
    for press in presses {
      guard let key = press.key, let symbol = morseSymbol(for: key) else {
        unhandled.insert(press)
        continue
      }
      activeKeyCodes.remove(key.keyCode)
      onExternalMorseKey?(symbol, "up")
    }
    if !unhandled.isEmpty {
      super.pressesEnded(unhandled, with: event)
    }
  }

  override func pressesCancelled(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
    var unhandled = Set<UIPress>()
    for press in presses {
      guard let key = press.key, let symbol = morseSymbol(for: key) else {
        unhandled.insert(press)
        continue
      }
      activeKeyCodes.remove(key.keyCode)
      onExternalMorseKey?(symbol, "up")
    }
    if !unhandled.isEmpty {
      super.pressesCancelled(unhandled, with: event)
    }
  }

  func resetPressedKeys() {
    activeKeyCodes.removeAll()
  }

  private func morseSymbol(for key: UIKey) -> String? {
    switch key.keyCode {
    case .keyboardLeftControl:
      return "."
    case .keyboardRightControl:
      return "-"
    default:
      break
    }

    switch key.charactersIgnoringModifiers {
    case "[":
      return "."
    case "]":
      return "-"
    default:
      return nil
    }
  }
}

private struct AppleAuthorizationFailure: LocalizedError {
  let code: String
  let message: String

  var errorDescription: String? {
    message
  }
}

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
  /// Keep in sync with AUDIO_VOLUME_MAX in @dit/core.
  private let maxToneVolume: Float = 0.9

  private func withLock<T>(_ body: () -> T) -> T {
    os_unfair_lock_lock(&stateLock)
    defer { os_unfair_lock_unlock(&stateLock) }
    return body()
  }

  private func configureSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      // Exclusive playback so Morse tones stay audible at normal system volume.
      // Volume amplitude is clamped in @dit/core before reaching native code.
      try session.setCategory(.playback)
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
    let clampedVolume = Float(max(0, min(volume, Double(maxToneVolume))))
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
    farnsworthUnitMs: Double,
    frequency: Double,
    volume: Double
  ) -> Bool {
    guard frequency > 0, characterUnitMs > 0, farnsworthUnitMs > 0 else {
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
    let farnsworthUnitFrames = max(1, Int((farnsworthUnitMs / 1000) * sampleRate))
    let interCharacterGapFrames = farnsworthUnitFrames * 3
    let interWordGapFrames = farnsworthUnitFrames * 7
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
    let clampedVolume = Float(max(0, min(volume, Double(maxToneVolume))))
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

/// Mirrors Morse audio with tactile feedback. Dit tones produce a dit-length
/// haptic; dah tones produce a dah-length haptic; silence is silence. Uses
/// CoreHaptics continuous events so a dah feels meaningfully longer than a
/// dit — not a transient buzz.
private final class HapticController {
  private var engine: CHHapticEngine?
  private var activePlayer: CHHapticPatternPlayer?
  private var keyingPlayer: CHHapticPatternPlayer?
  private let supportsHaptics: Bool
  private var isEnabled: Bool = true

  init() {
    supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics
  }

  func setEnabled(_ enabled: Bool) {
    isEnabled = enabled
    if !enabled {
      stopAll()
    }
  }

  private func ensureEngine() -> CHHapticEngine? {
    guard supportsHaptics else { return nil }
    if let engine { return engine }
    do {
      let created = try CHHapticEngine()
      created.isAutoShutdownEnabled = true
      created.resetHandler = { [weak self] in
        guard let self else { return }
        try? self.engine?.start()
      }
      created.stoppedHandler = { _ in }
      try created.start()
      engine = created
      return created
    } catch {
      return nil
    }
  }

  /// Start a continuous haptic that lasts until `stopKeying` is called.
  /// Used when the user is holding the Morse key so the buzz tracks the tone.
  func startKeying() {
    guard isEnabled else { return }
    guard let engine = ensureEngine() else { return }
    stopKeying()
    let event = CHHapticEvent(
      eventType: .hapticContinuous,
      parameters: [
        CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0),
        CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5),
      ],
      relativeTime: 0,
      duration: 30
    )
    do {
      let pattern = try CHHapticPattern(events: [event], parameters: [])
      let player = try engine.makePlayer(with: pattern)
      try player.start(atTime: CHHapticTimeImmediate)
      keyingPlayer = player
    } catch {
      keyingPlayer = nil
    }
  }

  func stopKeying() {
    guard let player = keyingPlayer else { return }
    try? player.stop(atTime: CHHapticTimeImmediate)
    keyingPlayer = nil
  }

  /// Play a haptic pattern that mirrors a parsed Morse code string. Uses the
  /// same character/effective unit durations as the audio so symbols stay
  /// aligned with their tones frame-for-frame at the listener's ear.
  func playMorseSequence(
    code: String,
    characterUnitMs: Double,
    farnsworthUnitMs: Double
  ) {
    guard isEnabled else { return }
    guard let engine = ensureEngine() else { return }
    guard characterUnitMs > 0, farnsworthUnitMs > 0 else { return }
    stopSequence()

    let characterUnit = characterUnitMs / 1000
    let farnsworthUnit = farnsworthUnitMs / 1000
    let interCharGap = farnsworthUnit * 3
    let interWordGap = farnsworthUnit * 7

    var events: [CHHapticEvent] = []
    var cursor: TimeInterval = 0
    let tokens = code.split(separator: " ", omittingEmptySubsequences: true)
      .filter { $0 == "/" || $0.contains(where: { $0 == "." || $0 == "-" }) }

    for (tokenIndex, token) in tokens.enumerated() {
      if token == "/" {
        cursor += interWordGap
        continue
      }
      let symbols = Array(token).filter { $0 == "." || $0 == "-" }
      for (symbolIndex, symbol) in symbols.enumerated() {
        let duration = symbol == "." ? characterUnit : characterUnit * 3
        events.append(
          CHHapticEvent(
            eventType: .hapticContinuous,
            parameters: [
              CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0),
              CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5),
            ],
            relativeTime: cursor,
            duration: duration
          )
        )
        cursor += duration
        if symbolIndex < symbols.count - 1 {
          cursor += characterUnit
        }
      }
      if tokenIndex < tokens.count - 1 {
        let next = tokens[tokenIndex + 1]
        cursor += next == "/" ? interWordGap : interCharGap
      }
    }

    guard !events.isEmpty else { return }
    do {
      let pattern = try CHHapticPattern(events: events, parameters: [])
      let player = try engine.makePlayer(with: pattern)
      try player.start(atTime: CHHapticTimeImmediate)
      activePlayer = player
    } catch {
      activePlayer = nil
    }
  }

  func stopSequence() {
    guard let player = activePlayer else { return }
    try? player.stop(atTime: CHHapticTimeImmediate)
    activePlayer = nil
  }

  func stopAll() {
    stopKeying()
    stopSequence()
  }
}

public final class DitNativeModule: Module {
  private let toneGenerator = ToneGenerator()
  private let hapticController = HapticController()
  private var appleAuthorizationCoordinator: AppleAuthorizationCoordinator?
  private var lowPowerModeObserver: NSObjectProtocol?
  private var outputVolumeObservation: NSKeyValueObservation?
  private var hardwareMorseKeyCaptureView: HardwareMorseKeyCaptureView?
  private var hardwareMorseKeyCaptureEnabled = false
  private var hardwareMorseKeyCaptureObservers: [NSObjectProtocol] = []

  private final class AppleAuthorizationCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private let promise: Promise
    private weak var presentationAnchor: UIWindow?
    private let onComplete: () -> Void
    private let requestedScopes: [ASAuthorization.Scope]
    private let errorCode: String
    private let cancellationCode: String
    private let onAuthorization: (ASAuthorizationAppleIDCredential, String) async throws -> [String: String]
    private var currentNonce: String?
    private var isResolved = false

    init(
      promise: Promise,
      presentationAnchor: UIWindow,
      requestedScopes: [ASAuthorization.Scope],
      errorCode: String,
      cancellationCode: String,
      onComplete: @escaping () -> Void,
      onAuthorization: @escaping (ASAuthorizationAppleIDCredential, String) async throws -> [String: String]
    ) {
      self.promise = promise
      self.presentationAnchor = presentationAnchor
      self.requestedScopes = requestedScopes
      self.errorCode = errorCode
      self.cancellationCode = cancellationCode
      self.onComplete = onComplete
      self.onAuthorization = onAuthorization
    }

    func start() {
      let nonce = randomNonceString()
      currentNonce = nonce

      let provider = ASAuthorizationAppleIDProvider()
      let request = provider.createRequest()
      request.requestedScopes = requestedScopes
      request.nonce = sha256(nonce)

      let controller = ASAuthorizationController(authorizationRequests: [request])
      controller.delegate = self
      controller.presentationContextProvider = self
      controller.performRequests()
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
      presentationAnchor ?? ASPresentationAnchor()
    }

    func authorizationController(
      controller: ASAuthorizationController,
      didCompleteWithAuthorization authorization: ASAuthorization
    ) {
      guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
        reject(code: errorCode, message: "Unexpected Apple credential type")
        return
      }

      guard let rawNonce = currentNonce else {
        reject(code: errorCode, message: "Missing Apple sign-in nonce")
        return
      }

      Task {
        do {
          let result = try await self.onAuthorization(credential, rawNonce)
          self.resolve(result)
        } catch let error as AppleAuthorizationFailure {
          self.reject(code: error.code, message: error.message)
        } catch {
          self.reject(code: self.errorCode, message: error.localizedDescription)
        }
      }
    }

    func authorizationController(
      controller: ASAuthorizationController,
      didCompleteWithError error: Error
    ) {
      let nsError = error as NSError
      if nsError.domain == ASAuthorizationError.errorDomain,
         nsError.code == ASAuthorizationError.canceled.rawValue {
        reject(code: cancellationCode, message: "The Apple sign-in flow was cancelled")
        return
      }

      reject(code: errorCode, message: error.localizedDescription)
    }

    private func resolve(_ value: [String: String]) {
      guard !isResolved else { return }
      isResolved = true
      promise.resolve(value)
      onComplete()
    }

    private func reject(code: String, message: String) {
      guard !isResolved else { return }
      isResolved = true
      promise.reject(code, message)
      onComplete()
    }

    private func randomNonceString(length: Int = 32) -> String {
      precondition(length > 0)
      let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
      var result = ""
      var remainingLength = length

      while remainingLength > 0 {
        var randoms = [UInt8](repeating: 0, count: 16)
        let errorCode = SecRandomCopyBytes(kSecRandomDefault, randoms.count, &randoms)
        if errorCode != errSecSuccess {
          fatalError("Unable to generate nonce. SecRandomCopyBytes failed with OSStatus \(errorCode)")
        }

        randoms.forEach { random in
          if remainingLength == 0 {
            return
          }

          if random < charset.count {
            result.append(charset[Int(random)])
            remainingLength -= 1
          }
        }
      }

      return result
    }

    private func sha256(_ input: String) -> String {
      let inputData = Data(input.utf8)
      let hashedData = SHA256.hash(data: inputData)
      return hashedData.map { String(format: "%02x", $0) }.joined()
    }
  }

  @discardableResult
  private func ensureFirebaseConfigured() throws -> FirebaseApp {
    if let app = FirebaseApp.app() {
      return app
    }

    guard let filePath = Bundle.main.path(
      forResource: "GoogleService-Info",
      ofType: "plist"
    ) else {
      throw AppleAuthorizationFailure(
        code: "ERR_FIREBASE_CONFIG",
        message: "GoogleService-Info.plist not found in app bundle"
      )
    }

    guard let options = FirebaseOptions(contentsOfFile: filePath) else {
      throw AppleAuthorizationFailure(
        code: "ERR_FIREBASE_CONFIG",
        message: "Could not load Firebase options from GoogleService-Info.plist"
      )
    }

    FirebaseApp.configure(options: options)

    guard let configuredApp = FirebaseApp.app() else {
      throw AppleAuthorizationFailure(
        code: "ERR_FIREBASE_CONFIG",
        message: "Firebase could not be configured"
      )
    }

    return configuredApp
  }

  private func ensureFirebaseConfigured(promise: Promise) -> FirebaseApp? {
    do {
      return try ensureFirebaseConfigured()
    } catch let error as AppleAuthorizationFailure {
      promise.reject(error.code, error.message)
      return nil
    } catch {
      promise.reject("ERR_FIREBASE_CONFIG", error.localizedDescription)
      return nil
    }
  }

  private func currentPresentationWindow() -> UIWindow? {
    let currentViewController = appContext?.utilities?.currentViewController()
    return currentViewController?.view.window
      ?? currentViewController?.viewIfLoaded?.window
      ?? UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap(\.windows)
        .first(where: \.isKeyWindow)
  }

  private func setHardwareMorseKeyCaptureEnabled(_ enabled: Bool) -> Bool {
    if Thread.isMainThread {
      return updateHardwareMorseKeyCaptureEnabled(enabled)
    }

    return DispatchQueue.main.sync {
      self.updateHardwareMorseKeyCaptureEnabled(enabled)
    }
  }

  private func updateHardwareMorseKeyCaptureEnabled(_ enabled: Bool) -> Bool {
    hardwareMorseKeyCaptureEnabled = enabled
    if enabled {
      startHardwareMorseKeyCaptureObservation()
      return installHardwareMorseKeyCaptureView()
    }

    stopHardwareMorseKeyCaptureObservation()
    removeHardwareMorseKeyCaptureView()
    return true
  }

  private func installHardwareMorseKeyCaptureView() -> Bool {
    guard let window = currentPresentationWindow() else {
      return false
    }

    if let view = hardwareMorseKeyCaptureView, view.window === window {
      return view.becomeFirstResponder()
    }

    removeHardwareMorseKeyCaptureView()

    let view = HardwareMorseKeyCaptureView(frame: .zero)
    view.backgroundColor = .clear
    view.accessibilityElementsHidden = true
    view.isAccessibilityElement = false
    view.onExternalMorseKey = { [weak self] symbol, phase in
      self?.sendEvent(externalMorseKeyEventName, [
        "symbol": symbol,
        "phase": phase
      ])
    }
    window.addSubview(view)
    hardwareMorseKeyCaptureView = view
    return view.becomeFirstResponder()
  }

  private func removeHardwareMorseKeyCaptureView() {
    guard let view = hardwareMorseKeyCaptureView else {
      return
    }

    view.resetPressedKeys()
    view.onExternalMorseKey = nil
    if view.isFirstResponder {
      view.resignFirstResponder()
    }
    view.removeFromSuperview()
    hardwareMorseKeyCaptureView = nil
  }

  private func refreshHardwareMorseKeyCaptureFocus() {
    guard hardwareMorseKeyCaptureEnabled else {
      return
    }

    if let view = hardwareMorseKeyCaptureView, view.window != nil {
      _ = view.becomeFirstResponder()
      return
    }

    _ = installHardwareMorseKeyCaptureView()
  }

  private func startHardwareMorseKeyCaptureObservation() {
    guard hardwareMorseKeyCaptureObservers.isEmpty else {
      return
    }

    let notificationNames: [Notification.Name] = [
      UIApplication.didBecomeActiveNotification,
      UIScene.didActivateNotification,
      UIWindow.didBecomeKeyNotification
    ]
    hardwareMorseKeyCaptureObservers = notificationNames.map { name in
      NotificationCenter.default.addObserver(
        forName: name,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.refreshHardwareMorseKeyCaptureFocus()
      }
    }
  }

  private func stopHardwareMorseKeyCaptureObservation() {
    hardwareMorseKeyCaptureObservers.forEach { observer in
      NotificationCenter.default.removeObserver(observer)
    }
    hardwareMorseKeyCaptureObservers.removeAll()
  }

  private func appleAuthorizationResult(
    from credential: ASAuthorizationAppleIDCredential,
    rawNonce: String,
    includeProfile: Bool,
    requireAuthorizationCode: Bool,
    errorCode: String
  ) throws -> [String: String] {
    guard let identityToken = credential.identityToken else {
      throw AppleAuthorizationFailure(
        code: errorCode,
        message: "No Apple identity token returned"
      )
    }

    guard let idToken = String(data: identityToken, encoding: .utf8) else {
      throw AppleAuthorizationFailure(
        code: errorCode,
        message: "Unable to serialize Apple identity token"
      )
    }

    var result = [
      "idToken": idToken,
      "rawNonce": rawNonce
    ]

    if let authorizationCodeData = credential.authorizationCode,
       let authorizationCode = String(data: authorizationCodeData, encoding: .utf8) {
      result["authorizationCode"] = authorizationCode
    } else if requireAuthorizationCode {
      throw AppleAuthorizationFailure(
        code: "ERR_APPLE_ACCOUNT_DELETION",
        message: "No Apple authorization code returned"
      )
    }

    if includeProfile {
      result["email"] = credential.email ?? ""
      result["givenName"] = credential.fullName?.givenName ?? ""
      result["familyName"] = credential.fullName?.familyName ?? ""
    }

    return result
  }

  private func currentLowPowerModePayload() -> [String: Bool] {
    [
      "isLowPowerModeEnabled": ProcessInfo.processInfo.isLowPowerModeEnabled
    ]
  }

  private func startLowPowerModeObservation() {
    guard lowPowerModeObserver == nil else {
      return
    }

    lowPowerModeObserver = NotificationCenter.default.addObserver(
      forName: Notification.Name.NSProcessInfoPowerStateDidChange,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      guard let self else {
        return
      }
      self.sendEvent("onLowPowerModeChanged", self.currentLowPowerModePayload())
    }
  }

  private func stopLowPowerModeObservation() {
    guard let lowPowerModeObserver else {
      return
    }
    NotificationCenter.default.removeObserver(lowPowerModeObserver)
    self.lowPowerModeObserver = nil
  }

  private func activatePlaybackSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playback)
      try session.setActive(true)
    } catch {
      // Fall back to whatever session state the system already has.
    }
  }

  private func readOutputVolume() -> Double {
    activatePlaybackSession()
    return Double(AVAudioSession.sharedInstance().outputVolume)
  }

  private func startOutputVolumeObservation() {
    guard outputVolumeObservation == nil else {
      return
    }

    activatePlaybackSession()
    let session = AVAudioSession.sharedInstance()
    outputVolumeObservation = session.observe(\.outputVolume, options: [.new, .initial]) {
      [weak self] observedSession, _ in
      guard let self else {
        return
      }
      self.sendEvent(
        "onOutputVolumeChanged",
        ["outputVolume": Double(observedSession.outputVolume)]
      )
    }
  }

  private func stopOutputVolumeObservation() {
    outputVolumeObservation?.invalidate()
    outputVolumeObservation = nil
  }

  public func definition() -> ModuleDefinition {
    Name("DitNative")

    Events("onLowPowerModeChanged", "onOutputVolumeChanged", externalMorseKeyEventName)

    OnStartObserving {
      self.startLowPowerModeObservation()
      self.startOutputVolumeObservation()
    }

    OnStopObserving {
      self.stopLowPowerModeObservation()
      self.stopOutputVolumeObservation()
    }

    Function("getHello") {
      return "Dit native module ready"
    }

    AsyncFunction("copyAssetToAppGroup") { (sourceUri: String, appGroup: String, filename: String) -> String? in
      guard let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroup
      ) else {
        return nil
      }
      let targetUrl = container.appendingPathComponent(filename)
      guard let sourceUrl = URL(string: sourceUri) else { return nil }
      if FileManager.default.fileExists(atPath: targetUrl.path) {
        try? FileManager.default.removeItem(at: targetUrl)
      }
      do {
        try FileManager.default.copyItem(at: sourceUrl, to: targetUrl)
      } catch {
        return nil
      }
      return targetUrl.absoluteString
    }

    AsyncFunction("getLowPowerModeEnabled") { () -> Bool in
      ProcessInfo.processInfo.isLowPowerModeEnabled
    }

    AsyncFunction("getOutputVolume") { () -> Double in
      self.readOutputVolume()
    }

    AsyncFunction("setHapticsEnabled") { (enabled: Bool) -> Bool in
      self.hapticController.setEnabled(enabled)
      return true
    }

    AsyncFunction("setExternalMorseKeyCaptureEnabled") { (enabled: Bool) -> Bool in
      return self.setHardwareMorseKeyCaptureEnabled(enabled)
    }

    AsyncFunction("startTone") { (frequency: Double, volume: Double) -> Bool in
      let started = self.toneGenerator.start(frequency: frequency, volume: volume)
      if started {
        self.hapticController.startKeying()
      }
      return started
    }

    AsyncFunction("stopTone") { () -> Bool in
      self.hapticController.stopKeying()
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

    AsyncFunction("playMorseSequence") { (code: String, characterUnitMs: Double, farnsworthUnitMs: Double, frequency: Double, volume: Double) -> Bool in
      let started = self.toneGenerator.playMorseSequence(
        code: code,
        characterUnitMs: characterUnitMs,
        farnsworthUnitMs: farnsworthUnitMs,
        frequency: frequency,
        volume: volume
      )
      if started {
        self.hapticController.playMorseSequence(
          code: code,
          characterUnitMs: characterUnitMs,
          farnsworthUnitMs: farnsworthUnitMs
        )
      }
      return started
    }

    AsyncFunction("stopMorseSequence") { () -> Bool in
      self.hapticController.stopSequence()
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

    AsyncFunction("signInWithApple") { (promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self else {
          promise.reject("ERR_APPLE_SIGN_IN", "Module unavailable")
          return
        }

        guard #available(iOS 13.0, *) else {
          promise.reject("ERR_APPLE_SIGN_IN", "Sign in with Apple requires iOS 13 or later")
          return
        }

        guard let presentationWindow = self.currentPresentationWindow() else {
          promise.reject("ERR_NO_VIEW_CONTROLLER", "Could not find presentation window for Apple sign-in")
          return
        }

        let coordinator = AppleAuthorizationCoordinator(
          promise: promise,
          presentationAnchor: presentationWindow,
          requestedScopes: [.fullName, .email],
          errorCode: "ERR_APPLE_SIGN_IN",
          cancellationCode: "ERR_APPLE_SIGN_IN_CANCELLED",
          onComplete: { [weak self] in
            self?.appleAuthorizationCoordinator = nil
          },
          onAuthorization: { [weak self] credential, rawNonce in
            guard let self else {
              throw AppleAuthorizationFailure(
                code: "ERR_APPLE_SIGN_IN",
                message: "Module unavailable"
              )
            }

            return try self.appleAuthorizationResult(
              from: credential,
              rawNonce: rawNonce,
              includeProfile: true,
              requireAuthorizationCode: false,
              errorCode: "ERR_APPLE_SIGN_IN"
            )
          }
        )
        self.appleAuthorizationCoordinator = coordinator
        coordinator.start()
      }
    }

    AsyncFunction("prepareAppleAccountDeletion") { (userId: String, promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self else {
          promise.reject("ERR_APPLE_ACCOUNT_DELETION", "Module unavailable")
          return
        }

        guard #available(iOS 13.0, *) else {
          promise.reject(
            "ERR_APPLE_ACCOUNT_DELETION",
            "Sign in with Apple requires iOS 13 or later"
          )
          return
        }

        guard self.ensureFirebaseConfigured(promise: promise) != nil else {
          return
        }

        guard let presentationWindow = self.currentPresentationWindow() else {
          promise.reject(
            "ERR_NO_VIEW_CONTROLLER",
            "Could not find presentation window for Apple sign-in"
          )
          return
        }

        let coordinator = AppleAuthorizationCoordinator(
          promise: promise,
          presentationAnchor: presentationWindow,
          requestedScopes: [],
          errorCode: "ERR_APPLE_ACCOUNT_DELETION",
          cancellationCode: "ERR_APPLE_ACCOUNT_DELETION_CANCELLED",
          onComplete: { [weak self] in
            self?.appleAuthorizationCoordinator = nil
          },
          onAuthorization: { [weak self] credential, rawNonce in
            guard let self else {
              throw AppleAuthorizationFailure(
                code: "ERR_APPLE_ACCOUNT_DELETION",
                message: "Module unavailable"
              )
            }

            let result = try self.appleAuthorizationResult(
              from: credential,
              rawNonce: rawNonce,
              includeProfile: false,
              requireAuthorizationCode: true,
              errorCode: "ERR_APPLE_ACCOUNT_DELETION"
            )

            guard let idToken = result["idToken"] else {
              throw AppleAuthorizationFailure(
                code: "ERR_APPLE_ACCOUNT_DELETION",
                message: "No Apple identity token returned"
              )
            }

            let firebaseCredential = OAuthProvider.appleCredential(
              withIDToken: idToken,
              rawNonce: rawNonce,
              fullName: credential.fullName
            )
            let auth = Auth.auth()

            if let currentUser = auth.currentUser, currentUser.uid == userId {
              _ = try await currentUser.reauthenticate(with: firebaseCredential)
              return result
            }

            if auth.currentUser != nil {
              try? auth.signOut()
            }

            let authResult = try await auth.signIn(with: firebaseCredential)
            guard authResult.user.uid == userId else {
              try? auth.signOut()
              throw AppleAuthorizationFailure(
                code: "ERR_APPLE_ACCOUNT_DELETION_USER_MISMATCH",
                message: "Please continue with the Apple account linked to this Dit account."
              )
            }

            return result
          }
        )
        self.appleAuthorizationCoordinator = coordinator
        coordinator.start()
      }
    }

    AsyncFunction("revokeAppleTokenForAccountDeletion") { (authorizationCode: String, userId: String) async throws in
      try ensureFirebaseConfigured()

      let auth = Auth.auth()
      guard let currentUser = auth.currentUser else {
        throw AppleAuthorizationFailure(
          code: "ERR_APPLE_ACCOUNT_DELETION",
          message: "No native Firebase user is available for Apple token revocation."
        )
      }

      guard currentUser.uid == userId else {
        try? auth.signOut()
        throw AppleAuthorizationFailure(
          code: "ERR_APPLE_ACCOUNT_DELETION_USER_MISMATCH",
          message: "Please continue with the Apple account linked to this Dit account."
        )
      }

      defer {
        try? auth.signOut()
      }

      try await auth.revokeToken(withAuthorizationCode: authorizationCode)
    }
  }
}
