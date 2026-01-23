import ExpoModulesCore

public final class DitNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DitNative")

    Function("getHello") {
      return "Dit native module ready"
    }

    AsyncFunction("triggerHaptics") { (_ pattern: [Int]) -> Bool in
      return false
    }

    AsyncFunction("playTone") { (_ frequency: Double, _ durationMs: Double, _ volume: Double) -> Bool in
      return false
    }
  }
}
