"""Exercise production press handlers with synthetic keys and a deterministic signal clock."""
from pathlib import Path
import subprocess
import sys
import tempfile

app = Path(__file__).resolve().parents[1]
root = app.parents[1]
baseline = "609ed8b9bf2d53879d7c9efd3e32b7d32b85b77f"
native = app / "modules/apple"

def view(source, name):
    start = source.index(f"private final class {name}: UIView")
    end = source.index("\n}\n", start) + 2
    return source[start:end]

exact = view((native / "DitKey.swift").read_text(), "DitInputView")
original = subprocess.check_output(["git", "show", baseline + ":modules/dit-native/ios/DitNativeModule.swift"],
                                   cwd=root, text=True)
reference = view(original, "HardwareMorseKeyCaptureView")
fixture = (app / "tests/hardware-paddle-check.swift").read_text()
clock = (app / "tests/apple-haptics-check.swift").read_text().split("private func checkHaptics()")[0]
with tempfile.TemporaryDirectory(prefix="dit-key-capture-") as temporary:
    scratch = Path(temporary)
    main = scratch / "main.swift"
    cache = scratch / "modules"
    if "--sdk" in sys.argv:
        main.write_text("import UIKit\nprivate class DitWaveMeter { func attach(to: UIWindow?) {} }\n" + exact)
        for sdk, target in [("iphonesimulator", "arm64-apple-ios26.0-simulator"), ("iphoneos", "arm64-apple-ios26.0")]:
            path = subprocess.check_output(["xcrun", "--sdk", sdk, "--show-sdk-path"], text=True).strip()
            subprocess.run(["xcrun", "swiftc", "-typecheck", "-swift-version", "5", "-sdk", path, "-target", target,
                            "-module-cache-path", cache, main], check=True)
            print("PASS UIKit capture view type-check", target, Path(path).name)
    else:
        main.write_text("\n".join([fixture, reference, exact, (native / "DitHaptics.swift").read_text(),
                                  (native / "DitKeySignal.swift").read_text(), clock, 'do { try verifyPaddleCapture() } catch { print("FAIL", error); exit(1) }' ]))
        clt = Path("/Library/Developer/CommandLineTools")
        subprocess.run([clt / "usr/bin/swift", "-swift-version", "5", "-sdk", clt / "SDKs/MacOSX.sdk",
                        "-module-cache-path", cache, main], check=True)
