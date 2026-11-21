#!/bin/sh
# Isolated macOS JavaScriptCore/file integration. No Apple mobile host is started.
set -eu
app_dir=$(CDPATH='' cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d "${TMPDIR:-/tmp}/dit-session-check.XXXXXX")
trap 'rm -rf "$work"' EXIT
cat "$app_dir/modules/apple/DitAccountFile.swift" "$app_dir/modules/apple/DitFixtureAccounts.swift" "$app_dir/modules/apple/DitLegacyStore.swift" "$app_dir/modules/apple/DitPromptPresentation.swift" "$app_dir/modules/apple/DitHaptics.swift" "$app_dir/modules/apple/DitPassagePlayer.swift" "$app_dir/modules/apple/DitKeySignal.swift" "$app_dir/modules/apple/DitReminderNotifications.swift" "$app_dir/modules/apple/DitAppleSession.swift" "$app_dir/tests/apple-session-check.swift" "$app_dir/tests/apple-haptics-check.swift" "$app_dir/tests/apple-listen-clock-check.swift" "$app_dir/tests/apple-legacy-check.swift" "$app_dir/tests/apple-words-check.swift" "$app_dir/tests/apple-custom-check.swift" "$app_dir/tests/apple-conversation-check.swift" "$app_dir/tests/apple-reset-check.swift" "$app_dir/tests/apple-account-check.swift" > "$work/main.swift"
clt=/Library/Developer/CommandLineTools
"$clt/usr/bin/swiftc" -tools-directory "$clt/usr/bin" -resource-dir "$clt/usr/lib/swift" -swift-version 5 -D DIT_FIXTURE_TEST -sdk "$clt/SDKs/MacOSX.sdk" \
  -module-cache-path "$work/module-cache" -framework JavaScriptCore -framework CoreHaptics "$work/main.swift" -o "$work/session-check"
"$work/session-check" "$app_dir/assets/dit-apple-session.js"
