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
Premiere 26.3 `premierepro` module and is type-checked against the pinned
`@adobe/premierepro@26.3.0` declarations. Failures degrade safely where possible.
Runtime behavior must still be confirmed by the operator in Premiere:

| Capability | API used | Status |
|---|---|---|
| Active selection | `Project.getActiveProject()` → sequence `getSelection()` | TYPE-CHECKED; host unverified |
| Per-clip components | `VideoClipTrackItem.getComponentChain()` | TYPE-CHECKED; host unverified |
| Read contract metadata | component `getParam(index).getStartValue()` | TYPE-CHECKED; host unverified |
| Resolve parameter index | generated registration order after contract handshake | TYPE-CHECKED; host unverified |
| Write logical param | `createKeyframe()` + `createSetValueAction()` | TYPE-CHECKED; host unverified |
| Single undo boundary | `project.executeTransaction()` + `CompoundAction.addAction()` | TYPE-CHECKED; host unverified |
| Apply effect by match name | `VideoFilterFactory.createComponent()` + append action | TYPE-CHECKED; host unverified |

Premiere 26.3 does not expose a per-parameter disk ID or name on `ComponentParam`.
The panel therefore uses the generated native registration order only after the
schema/revision/count handshake succeeds; incompatible instances remain read-only.

No CEP is used. If a required capability is proven unavailable in UXP, a separate
decision (Hybrid/native addon) must be approved before introduction — not assumed.

## Known limitations
- The corrected 25-parameter native effect must be rebuilt before combined host
  testing; the ignored `.aex` currently present in local workspaces may be stale.
- Bundled presets are seeded into the plugin data folder on first run; they are
  read-only. User presets live under `user/`.
- Preview cards are deterministic SVG (scale/rotation/opacity), not frame renders.
