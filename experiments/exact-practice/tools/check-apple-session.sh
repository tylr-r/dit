#!/bin/sh
# Isolated macOS JavaScriptCore/file integration. No Apple mobile host is started.
set -eu
case "${1:-}" in ""|--authenticated-progress|--identity-events|--custom-controls|--passage-wave) ;; *) exit 2 ;; esac
app_dir=$(CDPATH='' cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d "${TMPDIR:-/tmp}/dit-session-check.XXXXXX")
trap 'rm -rf "$work"' EXIT
if [ "${1:-}" = --passage-wave ]; then
    clt=/Library/Developer/CommandLineTools
    native="$app_dir/modules/apple"
    "$clt/usr/bin/swiftc" -swift-version 5 -D DIT_OFFLINE_AUDIO_TEST \
      -tools-directory "$clt/usr/bin" -resource-dir "$clt/usr/lib/swift" -sdk "$clt/SDKs/MacOSX.sdk" \
      -module-cache-path "$work/module-cache" "$native/DitKeySignal.swift" "$native/DitHaptics.swift" \
      "$native/DitPromptPresentation.swift" "$native/DitPassagePlayer.swift" "$native/DitSidetone.swift" "$native/DitListenWave.swift" \
      "$app_dir/tests/passage-wave-check.swift" -o "$work/passage-wave-check"
    "$work/passage-wave-check"
    exit 0
fi
cat "$app_dir/modules/apple/DitAccountFile.swift" "$app_dir/modules/apple/DitProgressDatabase.swift" "$app_dir/modules/apple/DitAuthenticatedProgressDatabase.swift" "$app_dir/modules/apple/DitProgressIdentitySession.swift" "$app_dir/modules/apple/DitFixtureAccounts.swift" "$app_dir/modules/apple/DitLegacyStore.swift" "$app_dir/modules/apple/DitPromptPresentation.swift" "$app_dir/modules/apple/DitHaptics.swift" "$app_dir/modules/apple/DitPassagePlayer.swift" "$app_dir/modules/apple/DitKeySignal.swift" "$app_dir/modules/apple/DitReminderNotifications.swift" "$app_dir/modules/apple/DitAppleSession.swift" "$app_dir/tests/apple-session-check.swift" "$app_dir/tests/apple-haptics-check.swift" "$app_dir/tests/apple-listen-clock-check.swift" "$app_dir/tests/apple-legacy-check.swift" "$app_dir/tests/apple-words-check.swift" "$app_dir/tests/apple-custom-check.swift" "$app_dir/tests/apple-conversation-check.swift" "$app_dir/tests/apple-reset-check.swift" "$app_dir/tests/apple-account-check.swift" "$app_dir/tests/apple-progress-database-check.swift" "$app_dir/tests/apple-authenticated-progress.swift" "$app_dir/tests/apple-authenticated-progress-session.swift" "$app_dir/tests/apple-account-reset-check.swift" "$app_dir/tests/apple-email-check.swift" "$app_dir/tests/apple-provider-check.swift" > "$work/main.swift"
clt=/Library/Developer/CommandLineTools
"$clt/usr/bin/swiftc" -tools-directory "$clt/usr/bin" -resource-dir "$clt/usr/lib/swift" -swift-version 5 -D DIT_FIXTURE_TEST -sdk "$clt/SDKs/MacOSX.sdk" \
  -module-cache-path "$work/module-cache" -framework JavaScriptCore -framework CoreHaptics "$work/main.swift" -o "$work/session-check"
asset="$app_dir/assets/dit-apple-session.js"
if [ "${1:-}" = --custom-controls ]; then
    TMPDIR="$work" "$work/session-check" "$asset" --custom-controls
    exit 0
fi
if [ -z "${1:-}" ]; then
    node "$app_dir/tests/progress-database-oracle.mjs" > "$work/progress-oracle.json"
    "$work/session-check" "$asset" "$work/progress-oracle.json"
fi
if [ "${1:-}" != --identity-events ]; then
    "$work/session-check" "$asset" --http-switch "$work/http-progress"
    shasum -a 256 "$work/http-progress/dit-accounts/"*.json > "$work/accounts.sha256"
    "$work/session-check" "$asset" --http-cold "$work/http-progress"
    shasum -a 256 -c --status "$work/accounts.sha256"
    echo 'PASS both private account files retain their SHA-256 across process exit and offline cold restore.'
fi
if [ "${1:-}" != --authenticated-progress ]; then
    "$work/session-check" "$asset" --identity-events "$work/identity-progress"
fi
