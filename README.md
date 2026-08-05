# StateMotion

StateMotion is an independently developed motion-transition effect and control
panel for Adobe Premiere Pro.

## Status

StateMotion is currently a v0.1 private-alpha candidate. Host-independent code
is implemented; the current native binary must still be rebuilt and the combined
native effect + UXP panel must be certified in Premiere Pro 26.3.

Currently implemented:

- Host-independent CPU transform renderer
- State A/B interpolation for position, scale, rotation, anchor, and opacity
- Crop and rounded rectangle masks (SDF renderer)
- Stroke (with angle & cycle speed), glow, and drop shadow compositing
- Multi-sample motion blur accumulation
- Spring and bounce easing evaluators and UI controls
- Stable generated parameter contract (70 parameters)
- C++ and TypeScript progress engines
- Seven progress modes
- Three alignment modes
- Shared C++/TypeScript parity fixtures
- Deterministic contract generation and validation tests
- Native effect parameter registration and CPU render integration
- Premiere Pro 26.3 UXP panel adapter and preset library
- Local user presets, favorites, collections, import/export, and diagnostics

Not currently implemented:

- Certified Premiere host integration (awaiting operator re-test)
- GPU rendering
- Batch tools
- Production installers

## Development status

Adobe host integration must not be considered release-ready until the corrected
25-parameter native effect has been rebuilt with the Adobe SDK and the release
checklist has been run inside Premiere Pro 26.3.

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

## Running tests

C++ renderer and progress-engine tests are built and run with a C++17 compiler
(for example MinGW-w64 GCC). TypeScript progress-engine tests:

```
node --experimental-transform-types src/statemotion/progress/progressEngine.test.ts
```

Panel verification:

```
cd src/statemotion/panel
npm ci
npm run typecheck
npm test
npm run build
```

Host-side certification status is tracked in
`docs/releases/v0.1-alpha-host-status.md`.
