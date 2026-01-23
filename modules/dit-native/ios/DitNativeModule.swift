import ExpoModulesCore

public final class DitNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DitNative")

    Function("getHello") {
      return "Dit native module ready"
    }
  }
}
