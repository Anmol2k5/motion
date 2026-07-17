# StateMotion

StateMotion is an independently developed motion-transition effect and control
panel for Adobe Premiere Pro.

## Status

StateMotion is currently in Phase 0.1 architecture validation.

It is not yet installable or usable inside Premiere Pro.

Currently implemented:

- Host-independent CPU transform renderer
- State A/B interpolation for position, scale, rotation, anchor, and opacity
- Stable generated parameter contract
- C++ and TypeScript progress engines
- Seven progress modes
- Three alignment modes
- Shared C++/TypeScript parity fixtures
- Deterministic contract generation and validation tests

Not currently implemented:

- Adobe native effect registration
- UXP panel integration
- Premiere timeline and selection integration
- GPU rendering
- Crop and rounded masks
- Stroke, glow, and shadow
- Motion blur
- Full preset management
- Batch tools
- Production installers

## Development status

The current codebase contains host-independent foundations only. Adobe host
integration must not be considered working until it has been built and tested
inside Premiere Pro with the appropriate Adobe SDK.

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

No Premiere Pro host integration exists yet; no host-side tests have been run.
