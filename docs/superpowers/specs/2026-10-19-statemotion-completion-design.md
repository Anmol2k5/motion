# StateMotion existing-feature completion design

Date: 2026-10-19. Status: approved by the user's instruction to start work after
the written design was presented.

## Intent and acceptance boundary

The user wants a functioning Premiere motion plugin with the state-based
animation workflow demonstrated by the supplied public product reference. They
approved repairing StateMotion's existing architecture. Preserve StateMotion's
own product identity and established native/preset compatibility boundaries.

The concrete first delivery completes and hardens the repository's existing
documented feature set: A/B transforms, automatic and manual progress, all seven
easing modes, crop/mask, stroke/glow/shadow, motion blur, presets, collections,
diagnostics, and a reproducible development package. Work follows the current
audit in `docs/research/2026-10-19-completion-audit.md`.

Website access is currently blocked by the environment proxy. Reference behavior
must be recorded after access works; no claim of demo equivalence is justified
yet. Any additional capabilities discovered there will be assessed against this
scope before altering interfaces or promising delivery. GPU acceleration,
licensing, cloud sync, telemetry, an updater, a macOS native port, and a consumer
installer are separate projects.

## Architecture and compatibility

Retain the current four boundaries: generated parameter contract, C++ engine,
host bridge/adapter, and panel UI with a file-backed preset repository. Keep
the effect match name, plugin ID, preset format identity, parameter disk IDs,
native parameter types, and existing canonical parameter keys stable.

Use normalized points, multiplier scale, radians, and unit opacity throughout
domain code. Convert only at display/native boundaries. Generated native defaults
are expressed in native units; UI/preview defaults must explicitly convert them
rather than treating the generated default as canonical.

Native popup indexing, runtime parameter identity, point units, and color
marshalling must be checked against the installed 26.3 API types and primary
Adobe SDK documentation. Test mocks must represent that contract. If the host
cannot establish a safe binding, disable writes and explain the mismatch instead
of guessing indexes. Correcting a native conversion must not silently reinterpret
older projects: inspect existing metadata/version behavior and document any
required compatibility migration before changing persisted semantics.

## Renderer and progress behavior

1. Remove the erroneous constant-return branch in native spring easing and
   match the independently specified fixture/TypeScript response. Preserve exact
   endpoints and deterministic handling of invalid/non-finite inputs.
2. Permit finite spring overshoot for position, rotation, anchor, and scale at
   interpolation. Clamp bounded properties at their physical boundary: opacity,
   crop fractions, colors, nonnegative radii/widths, and supported sample counts.
   Manual progress remains clamped to its supported range. Keep mirroring and
   near-zero scale protection.
3. Implement actual stroke and glow pixel compositing. Stroke follows the
   cropped/rounded rectangle mask in source space; width is expressed in source
   pixels. Its two colors interpolate along an angle-controlled gradient; phase
   advances with cycle speed. Glow follows transformed content alpha with a
   bounded radius and amount, using separable filtering rather than an unbounded
   nested per-pixel sampling loop. Compose shadow, glow, stroke, then content with
   premultiplied-alpha rules and deterministic disabled/zero-intensity behavior.
4. Share interpolation and frame-evaluation logic between single-sample and blur
   paths so property behavior does not diverge. Blur accumulates complete
   evaluated frames across the supported shutter interval; validate actual
   output, not just sample-count clamping. Do not claim source-time resampling
   unless the Adobe host path supports it.

Pixel tests must prove enabled stroke/glow change expected pixels, disabled effects
preserve the baseline, masks and alpha remain correct, gradient angle/color and
phase affect output, spring reaches the rendered transform, and blur differs
from an unblurred moving shape. Include cropped, transparent, padded-stride,
non-square, and zero/near-zero-scale cases using original synthetic fixtures.

## Host operations and error handling

Extend the host transaction seam with explicit cancellation. Stage actions until
commit; on preparation/write failure discard actions and pending components.
Never commit from a `finally` block. The operation that acquires a transaction
owns its commit/cancel lifecycle. Serialize mutating adapter operations to prevent
curve drags and other asynchronous UI events from starting nested transactions.

Validate an entire preset before adding an effect or queuing parameter actions.
Preflight logical values, compatibility, and parameter resolution. A missing
required mapping is a reported failure, not silent success. Curve edits submit
all four values in one operation. A successful single-clip operation is one undo
transaction. Bulk actions operate per clip, commit successful clips, cancel
failed clips, and return applied/skipped/failed IDs and structured reasons.

The UI disables affected actions while pending, restores confirmed values after
failure, shows a concise status, and refreshes in a controlled completion path.
Selection read failure is distinct from empty selection and from incompatible
contracts. Unsupported contracts are read-only; no control write is attempted.
Native undo and host transaction atomicity remain subject to Premiere testing.

## Panel workflow

Read one confirmed state snapshot per inspector render. Add A/B controls for
position, scale X/Y, rotation, anchor, and opacity; manual progress; and stroke
colors. Support explicit A/B swap and capture current compatible instance as a
named user preset. Point displays use normalized percentages with clear units;
scale and opacity use percentages; rotation uses degrees. Inputs retain decimals,
validate finite values/ranges, and convert to canonical units exactly once.

The inspector states clearly when it edits the first compatible selected clip;
bulk apply/swap/remove report outcomes for every selected clip. Selection identity
is checked before writes so a stale inspector cannot silently target a different
selection. Failed reads disable editing until retry succeeds.

Preset cards use canonical values and show both endpoints and direction correctly.
Their generated previews remain explanatory; the C++ renderer is the pixel source
of truth. Keep search focus/caret stable across filtering; prevent stale async
renders after search or tab changes. Wire collections to the library metadata's
membership list, including bundled presets without rewriting bundled files.
Add collection rename/delete/membership controls and filtering.

Use explicit file-picker/dialog adapters supported by UXP for import/export and
text entry/confirmation. Inject fakes for tests. Pending actions report failures
and successful applies alone update recent-use history. Diagnostics reflect
actual selection/compatibility/last-operation/error state. Clipboard reports
unavailability instead of silently succeeding. Load emitted CSS from entry HTML;
preserve keyboard access, focus indication, readable labels, and narrow-panel use.

## Preset validation and storage

Validate complete object shapes, string/array element types, safe preset IDs,
finite parameter values and generated parameter types/ranges, point tokens,
supported color syntax, creative ownership, and compatible metadata. Reject
null/array substitutes for object fields and unknown future schema/contracts.
Preserve unknown optional fields only after supported-format validation.

Migrate only explicitly recognized historical formats using their documented
unit/contract conversion. An unknown old/future revision is never rewritten as
current. Preserve original files when migration cannot establish correctness.
Use collision-resistant IDs with existence checks and serialize repository
mutations so concurrent duplicate/import actions cannot overwrite a preset.

Validate library metadata before replacing it. Preserve malformed original
metadata under a unique backup before writing recovered defaults; if backup
fails, leave the original untouched and report recovery failure. Surface skipped
invalid presets through sanitized warnings. Update in-memory state only after
the corresponding persistence succeeds. Remove deleted preset IDs from favorites,
recently used, and collections without deleting other presets.

## Validation and deliverables

Create regression tests that fail against the current defects before fixing them.
Correct the async storage-test summary so completed assertions determine its
outcome. Add a repository-level validation command that preserves nonzero exit
status and runs generated-contract checks, TypeScript progress tests, all SDK-free
C++ suites, panel typecheck/tests/build, and entry-asset/package checks. Build
outputs stay in ignored directories. Use moderate parallelism for native builds.

Produce a reproducible development-panel archive containing its manifest, entry
HTML, JS and CSS, plus original supporting assets if needed. Confirm every entry
reference resolves in that package. Exclude source dependencies, credentials,
user preset data, and stale/unverified native binaries. Update installation docs
for Node 24, Premiere Pro 26.3, manifest-based UXP loading, and Windows native
MSBuild/SDK prerequisites; distinguish unsupported platforms.

Linux acceptance requires every required automated check to execute and pass,
with current logs and a clean account of changed files. A native SDK compile
failure cannot be hidden by the SDK-free build.

Desktop acceptance requires a current native rebuild, installed binary hash,
Premiere/SDK versions, plugin load, selected-media apply, A/B edits, automatic
timing/trim cases, spring/bounce, crop/stroke/glow/shadow/blur, multiselection,
undo/redo, save/reopen, and export. Record results in the host ledger. The prior
`AEVideoFilter:11` blocker remains open until those checks succeed. Source fixes
and Linux tests alone do not close release certification or establish parity
with an unseen reference demo.
