/**
 * Post-install patch script for expo-constants and Xcode project configuration.
 *
 * This script fixes three iOS build issues that occur with pnpm workspaces:
 * 1. Missing resource directory in expo-constants shallow bundle builds
 * 2. Script execution failures in EXConstants.podspec due to bash -l -c wrapper
 * 3. Command substitution syntax issues in Xcode project bundler script
 *
 * Run automatically via pnpm postinstall hook to ensure consistent builds.
 */
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const pnpmStoreDir = path.join(repoRoot, 'node_modules', '.pnpm');
const hoistedExpoConstantsRoot = path.join(
  repoRoot,
  'node_modules',
  'expo-constants',
);
const hoistedScriptPath = path.join(
  hoistedExpoConstantsRoot,
  'scripts',
  'get-app-config-ios.sh',
);
const hoistedPodspecPath = path.join(
  hoistedExpoConstantsRoot,
  'ios',
  'EXConstants.podspec',
);

// PATCH 1: Fix missing mkdir in expo-constants get-app-config-ios.sh
// The original script fails to create RESOURCE_DEST directory for shallow bundles,
// causing build failures when copying resources. This adds the missing mkdir -p command.
const needle =
  'if [ "$BUNDLE_FORMAT" == "shallow" ]; then\n  RESOURCE_DEST="$DEST/$RESOURCE_BUNDLE_NAME"\n';
const patchedNeedle = `${needle}  mkdir -p "$RESOURCE_DEST"\n`;

// PATCH 2: Fix script execution in EXConstants.podspec
// The "bash -l -c" wrapper causes script failures in some environments.
// Simplifying to direct bash execution resolves the issue.
const podspecNeedle =
  ':script => "bash -l -c \\"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"",';
const podspecReplacement =
  ':script => "#{env_vars}bash -l \\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"",';
const podspecEnvNeedle =
  'env_vars = ENV[\'PROJECT_ROOT\'] ? "PROJECT_ROOT=#{ENV[\'PROJECT_ROOT\']} " : ""';
const podspecEnvReplacement =
  'env_vars = ENV[\'PROJECT_ROOT\'] ? "PROJECT_ROOT=\\"#{ENV[\'PROJECT_ROOT\']}\\" " : ""';

// PATCH 3: Fix command substitution in Xcode project bundler script
// Backtick-style command substitution in the bundle phase causes Xcode build failures.
// Replacing with $() syntax resolves compatibility issues.
const pbxprojPath = path.join(
  repoRoot,
  'apps',
  'ios',
  'ios',
  'Dit.xcodeproj',
  'project.pbxproj',
);
const rootPbxprojPath = path.join(
  repoRoot,
  'ios',
  'dit.xcodeproj',
  'project.pbxproj',
);
const pbxprojNeedle =
  "`\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\"`";
const pbxprojReplacement =
  '\\"$(\\"$NODE_BINARY\\" --print \\"require(\\\'path\\\').dirname(require.resolve(\\\'react-native/package.json\\\')) + \\\'/scripts/react-native-xcode.sh\\\'\\")\\"';

// Locate all expo-constants installations in the pnpm store.
// pnpm can have multiple versions of the same package, so we patch all of them.
const pnpmCandidates = fs.existsSync(pnpmStoreDir)
  ? fs
      .readdirSync(pnpmStoreDir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() && entry.name.startsWith('expo-constants@'),
      )
      .map((entry) =>
        path.join(
          pnpmStoreDir,
          entry.name,
          'node_modules',
          'expo-constants',
          'scripts',
          'get-app-config-ios.sh',
        ),
      )
      .filter((scriptPath) => fs.existsSync(scriptPath))
  : [];
const candidates = [
  ...pnpmCandidates,
  ...(fs.existsSync(hoistedScriptPath) ? [hoistedScriptPath] : []),
].filter((scriptPath, index, all) => all.indexOf(scriptPath) === index);

// Exit early if expo-constants isn't installed (shouldn't happen in normal workflow)
if (candidates.length === 0 && !fs.existsSync(hoistedPodspecPath)) {
  console.warn('expo-constants script not found; skipping patch.');
  process.exit(0);
}

// Track how many files we patch for reporting
let patchedCount = 0;
let podspecPatchedCount = 0;
let pbxprojPatched = false;

// Apply PATCH 1: Add mkdir for shallow bundle resource directory
for (const scriptPath of candidates) {
  const contents = fs.readFileSync(scriptPath, 'utf8');
  // Skip if already patched (idempotent operation)
  if (contents.includes(patchedNeedle)) {
    continue;
  }
  // Skip if the expected code pattern isn't found (version mismatch or already modified)
  if (!contents.includes(needle)) {
    console.warn(
      `Could not find shallow bundle block in ${scriptPath}; skipping.`,
    );
    continue;
  }
  // Apply the patch by adding mkdir -p command
  const updated = contents.replace(needle, patchedNeedle);
  fs.writeFileSync(scriptPath, updated);
  patchedCount += 1;
}

// Apply PATCH 2: Fix script execution syntax in EXConstants.podspec
// Locate podspec files relative to the patched shell scripts
const podspecCandidates = candidates
  .map((scriptPath) =>
    path.join(
      path.dirname(path.dirname(scriptPath)),
      'ios',
      'EXConstants.podspec',
    ),
  )
  .concat(fs.existsSync(hoistedPodspecPath) ? [hoistedPodspecPath] : [])
  .filter((podspecPath, index, all) => all.indexOf(podspecPath) === index) // Deduplicate paths
  .filter((podspecPath) => fs.existsSync(podspecPath)); // Only include files that exist

for (const podspecPath of podspecCandidates) {
  const contents = fs.readFileSync(podspecPath, 'utf8');
  let updated = contents;
  if (updated.includes(podspecNeedle)) {
    updated = updated.replace(podspecNeedle, podspecReplacement);
  }
  if (updated.includes(podspecEnvNeedle)) {
    updated = updated.replace(podspecEnvNeedle, podspecEnvReplacement);
  }
  if (updated !== contents) {
    fs.writeFileSync(podspecPath, updated);
    podspecPatchedCount += 1;
  }
}

// Apply PATCH 3: Fix command substitution syntax in Xcode projects
// Replace backticks with $() command substitution syntax for paths with spaces.
for (const projectPath of [pbxprojPath, rootPbxprojPath]) {
  if (!fs.existsSync(projectPath)) {
    continue;
  }
  const contents = fs.readFileSync(projectPath, 'utf8');
  if (!contents.includes(pbxprojNeedle)) {
    continue;
  }
  const updated = contents.replace(pbxprojNeedle, pbxprojReplacement);
  fs.writeFileSync(projectPath, updated);
  pbxprojPatched = true;
}

// Report results to user
// If nothing was patched, all patches were already applied (idempotent success)
if (patchedCount === 0 && podspecPatchedCount === 0 && !pbxprojPatched) {
  console.log('expo-constants patch already applied.');
} else {
  // Report each type of patch that was applied
  if (patchedCount > 0) {
    console.log(
      `Patched get-app-config-ios.sh in ${patchedCount} location(s).`,
    );
  }
  if (podspecPatchedCount > 0) {
    console.log(
      `Patched EXConstants.podspec in ${podspecPatchedCount} location(s).`,
    );
  }
  if (pbxprojPatched) {
    console.log('Patched bundle script in Xcode project.');
  }
}
