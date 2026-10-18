# StateMotion completion audit — 2026-10-19

Repository: `Anmol2k5/motion`, inspected commit `e7da94a994e66f4f05ad62c6d0f37f8f38df18ca`.

This report records current source inspection and Linux diagnostic results. It is
not Adobe host certification or a claim of parity with a commercial demo.

## User goal and reference access

The user wants the plugin to support the animation workflow demonstrated at
`https://www.jakeinmotion.com/motion-state`, and asked for repository analysis
before changes. The public website could not be inspected: the environment's
HTTPS proxy returned `CONNECT tunnel failed, response 403`. No demo playback,
website feature inventory, or visual comparison was performed. Existing
observations in `docs/clean-room-notes.md` are historical repository material,
not fresh observations of that page.

The environment configuration draft now includes `www.jakeinmotion.com` and
`jakeinmotion.com` as custom allowed domains, preserving package-manager presets.
Saving the draft does not apply a runtime network update or publish it. Further
video-host requirements must be derived from the page after access works.

## Existing architecture

- C++17 CPU renderer and progress/easing engine, with SDK-free tests.
- Adobe effect integration in `src/statemotion/adobe/statemotion_effect.cpp`;
  Windows Visual Studio project requires the Adobe After Effects Effect SDK.
- UXP TypeScript panel, using Premiere Pro API types pinned to 26.3.0.
- Generated contract: schema 1, binding revision 4, 70 parameters. Existing
  effect match name, parameter disk IDs, and preset identity are compatibility
  boundaries to preserve.
- Presets use normalized coordinates, scale multipliers, radians, and unit
  opacity internally; native sliders use different display units.

## Fresh baseline verification

| Check | Result |
| --- | --- |
| Locked dependency installation, `npm ci` | Passed during onboarding; repeat installation and bundling also passed |
| Panel `npm run typecheck` | Passed again for this audit |
| Panel `npm test` | Runner reports all 24 test files passed |
| Panel `npm run build` | Passed; emits nonempty `dist/main.js` and `dist/main.css` |
| Generated contract `--check` and generator tests | Passed again |
| TypeScript progress-engine test | Passed again, zero failures |
| SDK-free C++ binaries built with GCC 14.2, C++17 | 11 suites passed; easing suite failed with 38 spring fixture failures |
| Actual Premiere load, render, persistence, undo, export | Not run; Premiere and a supported desktop host are unavailable |

The panel test runner invokes test files directly. `presetStorage.test.ts` prints
`ALL PASSED (0)` before its async cases finish; eight subsequent PASS messages
were observed. Its summary timing is misleading and should be corrected rather
than used as an authoritative assertion count. Green baseline tests do not cover
the defects reproduced below.

Local current-run logs are under ignored `.scratch/cloud-tests/`; they are not
part of the committed project record. C++ tests were built and executed from the
repository root so shared fixture paths resolve correctly.

## Confirmed defects and incomplete paths

| Priority | Area | Evidence and effect |
| --- | --- | --- |
| Critical | Native spring easing | `progress/easing.cpp`, underdamped branch, contains a return multiplied by `(1.0 - 1.0)`. It returns constant 1 for affected intermediate samples. Existing easing fixtures report 38 failures. TypeScript uses the intended residual correction. |
| Critical | Stroke and glow do not render | `renderer/transform_render.cpp::plan` sets their flags, but `render` only composites source/mask/shadow and never consumes stroke/glow state. A 16×16 synthetic-image probe compared all RGBA channels against disabled output: enabling stroke changed zero pixels; enabling glow changed zero pixels. Existing AC12/AC13 tests assert flags/interpolation only. |
| High | Spring motion reaches interpolation clamping | `renderer/transform_state.hpp::interpolateCanonical` clamps progress to `[0,1]`. Even after fixing the spring evaluator, its overshoot cannot reach the canonical transform. Render-path tests must exercise actual spring positions, not only eased numbers. |
| High | Failed writes commit queued changes | `host/premiereAdapter.ts` calls `endUndo()` from `finally`, while `host/uxpHost.ts::endUndo` executes queued actions. An injected second-write failure produced `begin, write scaleX, write scaleY, commit`. There is no abort interface. |
| High | Concurrent control writes | `ui/inspector.ts` starts four independent writes for one curve change. `UxpHostBridge` rejects nested transactions; these failures are then swallowed by the inspector's empty catch. |
| High | Incomplete inspector | `InspectorView.render` renders timing, crop, shadow, stroke, glow, and motion blur, but no A/B position, scale, rotation, anchor, opacity controls and no manual-progress control. Stroke colors are absent. The repository field and imported preset types do not implement a capture action. |
| High | Preset preview uses wrong units | `preview/previewCard.ts` divides canonical scale and opacity by 100 and treats radians as degrees. A diagnostic with scale 1 and opacity 1 emitted a 0.34-pixel rectangle at opacity 0.01 instead of full-size opaque output. Position is not represented. |
| High | New preset cannot be created | `ui/manage.ts` hardcodes binding revision 2 / 25 parameters, while `PresetRepository.create` validates against revision 4 / 70 parameters. It creates an empty object instead of capturing the selected instance. |
| High | Malformed preset acceptance | A diagnostic using an object-valued numeric parameter, numeric name, traversal-like ID, and null compatible contract returned `validatePreset(...).ok === true`. Required-field presence is not sufficient validation. |
| High | Future-version metadata rewritten | `deserializePreset` calls broad migration without first rejecting unsupported versions. A schema-999 fixture became schema 1 / revision 4 / 70 parameters. Unknown future contracts must not be relabeled writable. |
| High | Incomplete runtime binding proof | `uxpHost.ts::enumerateParamIndex` returns generated array position rather than enumerating wire names. Parameter ordering, popup indexing, colors, and point units need verification against the real host. Current fake tests reproduce implementation assumptions and cannot establish host ABI correctness. |
| Medium | Missing stylesheet load | The esbuild script emits `dist/main.css`, but `index.html` only loads `dist/main.js`. No stylesheet link is present. |
| Medium | Read errors masquerade as defaults | `InspectorView.readConfig` catches all errors and returns an empty config; controls then display editable fallback values after failed or incompatible reads. |
| Medium | Async UI and operation reporting | Tab selection can render stale async results. Library apply callbacks discard reports and mark presets recently used even with no successful apply. Inspector actions lack reliable pending/error/partial-result states. |
| Medium | Storage recovery and IDs | Malformed `library.json` is overwritten on init without preserving it. Imported/duplicated presets use timestamp-only IDs and direct overwrite-capable writes. Preset deserialization does not itself validate. |
| Medium | Import/export runtime assumptions | Manage uses browser file input, Blob URLs, prompts, and confirm; supported UXP picker/dialog behavior needs verification or an adapter using Adobe APIs. |
| Medium | Collections incomplete | Domain rename/delete/membership helpers exist, but Manage renders only collection names/counts and creation; Library has no collection filter. |
| Medium | Diagnostics and clipboard | Runtime contract status / last operation are constant placeholders. Optional clipboard invocation can report no failure even if no clipboard exists. |
| Medium | Installation documentation | Existing instructions claim Node 18+, leave Premiere version TBD, suggest loading `dist/main.js` instead of the plugin manifest, and describe Windows `.aex` output on macOS. These conflict with the current implementation and platform requirements. |

## Distinguish implementation from certification

The renderer contains working test paths for transform, crop, mask, and shadow;
stroke/glow state exists but their pixel compositing is absent. Native blur code
also needs end-to-end validation. These source observations are not proof of
correct rendering in Premiere. The existing host ledger
records a prior `AEVideoFilter:11` exception and says the world-pixel fix still
needs an operator retest. No native AEX was rebuilt in this Linux environment.

The project currently has a Windows native build project; a macOS deliverable is
not established by a cross-platform TypeScript build. GPU acceleration, licensing,
cloud sync, telemetry, and automatic update are explicitly deferred in the scope
document. No reference-demo observation has yet established that additional
features are required for the user's intended workflow.

## Completion criteria to agree before implementation

1. Confirm the reference's observable workflow after page/demo access works.
2. Repair the existing renderer/panel architecture while preserving distributed
   identities and saved-project compatibility; document any necessary migration.
3. Cover the defects above with meaningful failing regression tests, then verify
   all 12 SDK-free C++ suites, contract checks, TypeScript progress tests, panel
   typecheck/tests/build, and panel entry assets.
4. Provide a reproducible release-validation command and a development package
   containing the manifest, HTML, JS, and CSS. Do not label it a finished native
   installer or include an unbuilt/stale AEX.
5. Verify selected-media apply, A/B editing, timing after trims, easing, crop/FX,
   multiple clips, undo, save/reopen, and export inside Premiere Pro 26.3 with the
   rebuilt native effect. Record the installed binary hash and host version.

This is an audit and proposed acceptance boundary, not an approved implementation
specification. No product code was changed during this analysis.
