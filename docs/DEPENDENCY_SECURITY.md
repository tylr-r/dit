# Dependency security

The workspace pins pnpm 10.33.2 and records the resolved graph in `pnpm-lock.yaml`. Root overrides set patched floors for vulnerable transitive dependencies. React Native and Expo remain on the Expo SDK 58 platform line.

## Patched toolchain

- Expo 58.0.22 and its recommended companion patch versions use the updated CLI, which removes the runtime Zod 3 dependency. Remaining Zod consumers resolve to the patched 4.6 line.
- Storybook native packages use 10.7.1 with an explicit patched Storybook 10.6.5 peer. Vite and Vitest stay on patched versions of their existing major lines. Sharp uses 0.35.5.
- Modern glob 13 consumers move together to glob 14.0.3 and minimatch 11.0.3. Legacy glob 7 and minimatch 3 remain on their compatible APIs; replacing their callable exports globally breaks Jest and ESLint.
- Expo's updated configuration plugins use upstream Xcode 4, whose UUID generator uses Node crypto. The obsolete Xcode 3 UUID patch is removed.

## Reviewed audit entries

Raw version-based audit output retains these two entries. Their status is assessed separately from scanner counts; no advisory ignore list is configured.

| Advisory | Installed component | Assessment |
| --- | --- | --- |
| [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | deepmerge 4.3.1 with a recorded pnpm patch | Locally remediated. The patch rejects `__proto__` keys in both source and target copying, including distributed CommonJS and UMD builds. Version-only scanners still report 4.3.1. |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | minimatch 3.1.5 | Source-based applicability review: this branch does not contain the advanced preprocessing or optimization levels described by the advisory. The vulnerable modern branch has been upgraded. The aggregate advisory range is broader than the mechanism and the maintainer's affected-version statement. |

The deepmerge backport follows the narrow key-filter change in [upstream proposal 274](https://github.com/TehShrike/deepmerge/pull/274). Regression tests cover null-prototype targets, nested null placeholders, target-owned prototype keys, array cloning, custom merge options, and clone:false behavior. Reassess and retire the patch when an upstream release incorporates the fix.

The [minimatch maintainer advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249) describes `firstPhasePreProcess` with `optimizationLevel >= 2` in 10.2.6. The retained [3.1.5 implementation](https://github.com/isaacs/minimatch/blob/v3.1.5/minimatch.js) has neither feature. This conclusion concerns that advisory only.

## Verification

- `pnpm install --frozen-lockfile`: verify the locked dependency graph and recorded patches can be installed.
- `pnpm run test:security`: exercise the patched merge behavior, modern and legacy glob contracts, and Xcode UUID generation.
- `pnpm audit`: inspect the complete raw advisory results, including the two reviewed entries above.
- Run the normal lint, type, unit and browser suites. Check Expo dependency alignment and perform web and native build verification after toolchain changes.
