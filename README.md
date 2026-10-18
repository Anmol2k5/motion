# StateMotion

StateMotion is an independently developed motion-transition effect and control
panel for Adobe Premiere Pro.

## Status

StateMotion is a development alpha with a C++17 CPU renderer and a UXP panel
for Premiere Pro 26.3+. The current code needs a fresh Windows native rebuild
and Adobe host certification before release.

Implemented development workflow:

- A/B position, scale, rotation, anchor and opacity controls
- Seven progress modes, three alignments, custom easing, spring and bounce
- Crop/rounded masks, gradient strokes, alpha glow, shadows and shutter sampling
- Safe staged parameter transactions with per-clip results and explicit cancellation
- Original presets, live capture, search, favorites, collections, import/export
- Canonical-value validation, explicit legacy preset migration and storage recovery
- Diagnostics, deterministic contract generation and reproducible panel packaging

Linux verification covers SDK-free math/rendering and injected host/UI behavior.
It does not certify Premiere load/render, saved projects, native undo or export.
GPU rendering, a macOS native port and consumer installers remain outside this alpha.

Binding revision 5 corrects popup wire indexing while retaining the 70 parameter
IDs. Older project effects retain their historical native interpretation and are
read-only to the new panel; supported historical preset files can be imported.
See [development installation](docs/releases/v0.1-alpha-installation.md).

## Clean-room development

StateMotion is independently designed and implemented.

The project must not include proprietary third-party plugin code, assets,
presets, binaries, extracted parameter data, branding, or copied UI resources.

## Trademark notice

Adobe and Premiere Pro are trademarks of Adobe. StateMotion is independent
software and is not affiliated with or endorsed by Adobe.

## Repository layout

- `src/statemotion/renderer/` — host-independent CPU transform renderer
- `src/statemotion/progress/` — C++ and TypeScript progress engines
- `shared/schema/` — parameter contract and progress parity fixtures
- `shared/generated/` — generated parameter bindings (C++ headers and TypeScript)
- `tools/` — deterministic contract generator and validation
- `docs/` — clean-room notes, research records, and Phase 0.1 handoff

## Verifying the contract

```
node tools/generate-contract.js --check
node tools/generate-contract.test.js
```

## Development verification and package

Requires Node.js 24 and a C++17 compiler. From the repository root:

```sh
npm --prefix src/statemotion/panel ci
node tools/verify-development.mjs
node tools/package-panel.mjs
```

The verifier runs contract generation checks, TypeScript progress tests, all
SDK-free C++ suites, panel typecheck/tests/build, and packaging checks. It prints
current logs under `build/verification/`. The panel ZIP is
`dist/statemotion-panel-dev.zip`; load its **manifest.json** through UXP Developer
Tool after building/installing the matching native effect.

See [installation](docs/releases/v0.1-alpha-installation.md) and
[host certification status](docs/releases/v0.1-alpha-host-status.md). Native build,
point/popup host units, timing after trims, save/reopen, undo and export remain
operator checks.
