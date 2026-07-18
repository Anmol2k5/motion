# StateMotion Preset Panel — UXP Development & Host Verification

Original UXP panel for Premiere Pro. Independent clean-room implementation.

## Panel identity (permanent)
- Plugin ID: `io.github.anmol2k5.statemotion.panel`
- Effect match name (also used by the adapter): `AE.io.github.anmol2k5.statemotion.effect`
- Preset format: `io.github.anmol2k5.statemotion.preset` (`.stmpreset`)

## Required environment
- Adobe Premiere Pro 2026 (26.x) with UXP support.
- UXP Developer Tools (for load/reload of unsigned panels in dev).
- Node 22+ to run the generator and the test runner.
- A bundler for the panel (esbuild, dev-only). UXP cannot load a raw TS module
  graph, so `src/main.ts` is bundled to `dist/main.js` (referenced by `index.html`).

## Build
```bash
cd src/statemotion/panel
npm install          # installs esbuild (devDependency only)
npm run build        # -> dist/main.js
npm test             # run all domain/host tests via Node
```

## Developer load / reload (Premiere)
1. Build the panel (`npm run build`).
2. Open UXP Developer Tools → Add Plugin → select `src/statemotion/panel` (folder
   containing `manifest.json`).
3. Load the plugin; it appears under Window → Extensions → StateMotion.
4. Edit source, rebuild, then Reload in UXP Developer Tools.

## Logs
- UXP Developer Tools console shows `console.*` output and uncaught errors.
- A load failure surfaces via `main().catch` setting `#app` text to the error.

## Host API status (verify in your Premiere build)
The `UxpHostBridge` (`src/host/uxpHost.ts`) is implemented against the documented
UXP `app` / `premierepro` object model, but **every call is guarded** and failures
degrade safely (e.g. a clip with no reachable StateMotion effect is reported as
"unsupported" rather than crashing). The following capabilities must be confirmed
by the operator in the actual Premiere environment:

| Capability | API used (proposed) | Status |
|---|---|---|
| Active sequence + tracks | `app.project.activeSequence.videoTracks[].clips` | PROTOTYPE — verify object shape |
| Per-clip components | `clip.components[]` (matchName) | PROTOTYPE — verify match-name access |
| Read contract metadata | effect `properties` by persistentID (disk 1/2/3) | PROTOTYPE — verify persistentID semantics |
| Enumerate param index | effect `properties` by `displayName` (wireName) | PROTOTYPE — verify displayName == wireName |
| Write logical param | `property.setValue(...)` | **UNVERIFIED** — see note below |
| Single undo boundary | `app.beginUndo` / `app.endUndo` | PROTOTYPE — verify availability |
| Apply effect by match name | `clip.addEffect(MATCH_NAME)` | PROTOTYPE — verify addEffect signature |

**Parameter write note:** `writeLogical` currently resolves the effect and is a
guarded stub. The exact UXP call to set a parameter value (and whether it requires
the property object vs a typed setter) must be confirmed against the installed
Premiere UXP build before claiming host-side apply works. Until then, the
**fully verified** parts are: preset domain, storage, search, favorites,
collections, preview, compatibility, parameter-map resolution logic, and the
apply-plan classification (all covered by automated tests).

No CEP is used. If a required capability is proven unavailable in UXP, a separate
decision (Hybrid/native addon) must be approved before introduction — not assumed.

## Known limitations
- The native parameter-registration milestone on `feat/native-parameter-registration`
  was not merged when this panel branched; the panel consumes only the committed
  logical contract (`shared/generated/parameterBindings.ts`). Apply against the
  native effect requires the native params to be registered and the UXP write API
  verified.
- Bundled presets are seeded into the plugin data folder on first run; they are
  read-only. User presets live under `user/`.
- Preview cards are deterministic SVG (scale/rotation/opacity), not frame renders.
