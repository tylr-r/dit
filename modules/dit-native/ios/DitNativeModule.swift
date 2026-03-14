import AVFoundation
import AuthenticationServices
import CryptoKit
import ExpoModulesCore
import FirebaseAuth
import GoogleSignIn
import FirebaseCore
import os.lock
import Security

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
  private var appleAuthorizationCoordinator: AppleAuthorizationCoordinator?

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
