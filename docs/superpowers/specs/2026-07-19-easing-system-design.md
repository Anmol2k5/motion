# StateMotion Easing + Custom Curve System — Design Spec

**Date:** 2026-07-19
**Branch:** `feat/easing-system` (worktree `E:\motion-easing`, based on `feat/panel-native-integration` @ `25b57e5`)
**Skills:** brainstorming, writing-plans, TDD, systematic-debugging, subagent-driven-development, requesting-code-review, receiving-code-review, verification-before-completion
**Ponytail:** shortest diff, no premature abstraction, no new deps, no GPU/renderer rewrite.

## 1. Problem

The progress engine hardcodes `smoothstep(t) = t*t*(3-2t)` as the only easing
curve, duplicated in two active engines (`progress_engine.cpp`, `progressEngine.ts`)
plus one dead copy (`transform_render.cpp:evaluateCurve`). There is no way to pick
Linear / Ease In / Ease Out / Ease In Out / Custom cubic Bezier, and presets cannot
carry an easing choice.

## 2. Goal

Replace the hardcoded smoothstep with a single host-independent easing evaluator
shared by C++ and TypeScript, selectable per-instance via permanent native
parameters, and storable in presets. Live Premiere testing is deferred; the system
must be fully unit-testable now (fixtures + parity).

## 3. Canonical model

```cpp
enum class EasingMode {        // permanent, append-only numeric identity
    LINEAR     = 0,
    EASE_IN    = 1,
    EASE_OUT   = 2,
    EASE_IN_OUT = 3,
    CUSTOM     = 4
};
struct EasingCurve { double x1, y1, x2, y2; };  // canonical 0..1 control points
```

- Named modes resolve internally to **fixed StateMotion-owned curves** (not stored
  as beziers). Only `CUSTOM` reads the four stored control points.
- The four curve fields are ALWAYS stored in the contract/preset (ignored unless
  mode == CUSTOM) so serialization is stable and forward-compatible.

## 4. Easing evaluator (one mathematical contract)

`double evaluateEasing(EasingMode mode, const EasingCurve& curve, double lin)`

- `lin` clamped to [0,1]; output in [0,1].
- Named modes (original StateMotion defaults, NOT copied from any commercial product):
  - LINEAR: `lin`
  - EASE_IN: `lin*lin` (quadratic in)
  - EASE_OUT: `1 - (1-lin)*(1-lin)`
  - EASE_IN_OUT: `smoothstep(lin) = lin*lin*(3-2*lin)`
  - CUSTOM: cubic Bezier timing function with P0=(0,0), P1=(x1,y1), P2=(x2,y2), P3=(1,1).
- **Cubic Bezier solver:** given input `X`, solve `BezierX(t) = X` for `t` then
  return `BezierY(t)`. Implement Newton-Raphson using the analytic derivative
  `BezierX'(t)`; if the derivative is near-zero or Newton diverges, fall back to
  bounded binary subdivision on `t∈[0,1]`. Clamp `X` to [0,1]; `t` result clamped to
  [0,1].
- Invalid / non-finite control points or input → deterministic fallback: return `X`
  (linear). No throw, no NaN.
- Endpoints: `evaluateEasing(mode, any, 0) == 0` and `== 1` for all modes (Bezier
  endpoints P0,P3 are fixed; named modes are exact at 0/1).

C++ and TypeScript implementations are line-for-line the same algorithm, both
driven by the identical JSON fixture `shared/fixtures/easing-fixtures.json`.

## 5. Parameter contract (append only)

Disk IDs 55–59 added inside `progressCurve` range (50–99), confirmed free.

| logicalId | diskId | wireName | nativeType | default | oldProjectDefault | range |
|---|---|---|---|---|---|---|
| `transition.easing` | 55 | `SM Easing` | POPUP (enumRef `EasingMode`) | 3 (EASE_IN_OUT) | 3 | — |
| `transition.curveX1` | 56 | `SM Curve X1` | FLOAT_SLIDER | 0.42 | 0.42 | 0..1 |
| `transition.curveY1` | 57 | `SM Curve Y1` | FLOAT_SLIDER | 0.0 | 0.0 | 0..1 |
| `transition.curveX2` | 58 | `SM Curve X2` | FLOAT_SLIDER | 0.58 | 0.58 | 0..1 |
| `transition.curveY2` | 59 | `SM Curve Y2` | FLOAT_SLIDER | 1.0 | 1.0 | 0..1 |

- `parameterCount` 20 → 25; `bindingRevision` 1 → 2.
- Existing IDs 50–54 unchanged (diskId, default, nativeType).
- `EasingMode` enum appended to the contract + to `REQUIRED_ENUMS` in
  `tools/generate-contract.js` so the generator emits it into both bindings.
- No new nativeType; curve params use FLOAT_SLIDER with 0..1 range (conservative,
  no overshoot this milestone — Y bounded to [0,1]).

## 6. Panel value conversion (boundary only)

`valueConversion.ts` gains conversions for the five new logical IDs, keyed by
generated `LOGICAL_IDS` (no raw strings):
- `transition.easing`: POPUP integer ↔ canonical enum integer (identity).
- `transition.curveX1/Y1/X2/Y2`: FLOAT_SLIDER holding 0..1 canonical control points,
  stored natively as 0..1 → **identity** (no ×100). This is the simplest reliable
  representation and matches the canonical model, so no unit conversion is needed.
- `nativeType` remains only a validation guard.

## 7. Progress engine integration

Refactor `evaluateProgress` (C++ + TS): after `computeLinearProgress` produces
`linear`, apply `evaluateEasing(input.easing, input.curve, linear)` to get
`easedProgress`. The mode→easing dispatch is replaced by passing the easing config
through `ProgressInput`.
- **Manual mode:** bypasses easing — `easedProgress = linear` (= `manualProgress`
  clamped). `Manual 50` deterministically = midpoint between A and B. **Documented,
  tested.**
- HoldA → `easedProgress = 0`, HoldB → `1` (exact endpoints, never eased).
- AToB/AToBToA/BToA/BToAToB use the easing config on their (possibly split) linear
  progress, exactly as before but with the configurable curve.
- The dead `transform_render.cpp:evaluateCurve` is deleted (single source of truth).

## 8. Native parameter registration

`statemotion_effect.cpp` registers the five new parameters (POPUP for easing with
label order `Linear|Ease In|Ease Out|Ease In Out|Custom`, FLOAT_SLIDER for the four
curve values). Controls are kept visible (no dynamic show/hide this milestone).
The effect reads them into `ProgressInput` (`buildProgressInput` extended). Default
effect value for `transition.easing` = EASE_IN_OUT, curve defaults = legacy
`(0.42,0,0.58,1.0)`.

## 9. Preset schema + migration

- `CanonicalStateMotionConfig` and preset `parameters` include `transition.easing`
  (always) + the four `transition.curve*` (always, default legacy curve).
- Old `.stmpreset` files without easing fields → migrated to
  `EASE_IN_OUT` with legacy curve `(0.42,0,0.58,1.0)` (preserves prior smoothstep
  visual behavior). Migration is pure/unit-tested.
- No runtime index, diskId, or metadata stored in creative preset values.

## 10. Panel UI

Inspector gets an Easing dropdown (5 original StateMotion labels) and, when Custom
is selected, four numeric inputs (X1/Y1/X2/Y2). No graph editor this milestone.
`previewCard.ts` stays endpoint-only (deterministic); easing is not drawn yet.

## 11. Starter presets

The 16 bundled presets get an `EasingMode` variety (Linear / Ease In / Ease Out /
Ease In Out); **no Custom** for starters. Existing creative transforms unchanged.

## 12. Backward compatibility (unit-tested now)

- Gen A (identity-only) / Gen B (transform, no easing params): the contract's
  `oldProjectDefault` for `transition.easing` = 3 (EASE_IN_OUT) with legacy curve,
  so old projects render with the previous smoothstep-equivalent behavior.
- Gen C (current): explicit easing values persist.
- Premiere persistence itself remains NOT YET OPERATOR VERIFIED.

## 13. Host verification debt (preserved)

Native rendering, panel host integration, and the new easing native controls are
all **NOT YET OPERATOR VERIFIED**. Implementation is complete and automated-test-green;
operator runs real Premiere later.

## 14. Out of scope

GPU, motion blur, crop, masks, stroke, glow, shadow, licensing, installer,
telemetry, interactive curve graph editor, overshoot (Y>1).
