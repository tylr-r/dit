import AVFoundation
import ExpoModulesCore
import FirebaseAuth
import GoogleSignIn
import FirebaseCore

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
