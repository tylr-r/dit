import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const pnpmStoreDir = path.join(repoRoot, 'node_modules', '.pnpm');
const needle =
  'if [ "$BUNDLE_FORMAT" == "shallow" ]; then\n  RESOURCE_DEST="$DEST/$RESOURCE_BUNDLE_NAME"\n';
const patchedNeedle = `${needle}  mkdir -p "$RESOURCE_DEST"\n`;
const podspecNeedle =
  ':script => "bash -l -c \\"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"",';
const podspecReplacement =
  ':script => "#{env_vars}bash -l \\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"",';
const pbxprojPath = path.join(
  repoRoot,
  'apps',
  'ios',
  'ios',
  'Dit.xcodeproj',
  'project.pbxproj'
);
const pbxprojNeedle =
  "`\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\"`";
const pbxprojReplacement =
  "\"$(\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\")\"";

if (!fs.existsSync(pnpmStoreDir)) {
  console.warn('pnpm store not found; skipping expo-constants patch.');
  process.exit(0);
}

const candidates = fs
  .readdirSync(pnpmStoreDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('expo-constants@'))
  .map((entry) =>
    path.join(
      pnpmStoreDir,
      entry.name,
      'node_modules',
      'expo-constants',
      'scripts',
      'get-app-config-ios.sh'
    )
  )
  .filter((scriptPath) => fs.existsSync(scriptPath));

if (candidates.length === 0) {
  console.warn('expo-constants script not found in pnpm store; skipping patch.');
  process.exit(0);
}

let patchedCount = 0;
let podspecPatchedCount = 0;
let pbxprojPatched = false;
for (const scriptPath of candidates) {
  const contents = fs.readFileSync(scriptPath, 'utf8');
  if (contents.includes(patchedNeedle)) {
    continue;
  }
  if (!contents.includes(needle)) {
    console.warn(`Could not find shallow bundle block in ${scriptPath}; skipping.`);
    continue;
  }
  const updated = contents.replace(needle, patchedNeedle);
  fs.writeFileSync(scriptPath, updated);
  patchedCount += 1;
}

const podspecCandidates = candidates
  .map((scriptPath) => path.join(path.dirname(path.dirname(scriptPath)), 'ios', 'EXConstants.podspec'))
  .filter((podspecPath, index, all) => all.indexOf(podspecPath) === index)
  .filter((podspecPath) => fs.existsSync(podspecPath));

for (const podspecPath of podspecCandidates) {
  const contents = fs.readFileSync(podspecPath, 'utf8');
  if (!contents.includes(podspecNeedle)) {
    continue;
  }
  const updated = contents.replace(podspecNeedle, podspecReplacement);
  fs.writeFileSync(podspecPath, updated);
  podspecPatchedCount += 1;
}

if (fs.existsSync(pbxprojPath)) {
  const contents = fs.readFileSync(pbxprojPath, 'utf8');
  if (contents.includes(pbxprojNeedle)) {
    const updated = contents.replace(pbxprojNeedle, pbxprojReplacement);
    fs.writeFileSync(pbxprojPath, updated);
    pbxprojPatched = true;
  }
}

if (patchedCount === 0 && podspecPatchedCount === 0 && !pbxprojPatched) {
  console.log('expo-constants patch already applied.');
} else {
  if (patchedCount > 0) {
    console.log(`Patched get-app-config-ios.sh in ${patchedCount} location(s).`);
  }
  if (podspecPatchedCount > 0) {
    console.log(`Patched EXConstants.podspec in ${podspecPatchedCount} location(s).`);
  }
  if (pbxprojPatched) {
    console.log('Patched bundle script in Xcode project.');
  }
}
