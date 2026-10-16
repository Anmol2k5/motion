# Audit Report — StateMotion

**Audit date:** 2026-10-16 (updated source verification)  
**Repository:** Anmol2k5/motion, default branch `main`  
**Scope:** GitHub-sourced code and documentation review; attempted terminal clone; current GitHub contents API inspection.  
**Evidence distinction:** CONFIRMED = directly observed in current source; RECORDED = repository's previous operator/test logs; NOT VERIFIED = cannot validate in current runtime.

## 1. Summary

**Verdict: Not ready for public launch; private alpha also blocked pending host certification.** StateMotion is a C++17 native effect and TypeScript/UXP panel for Premiere Pro 26.3. Its host-independent renderer, generated 70-parameter contract, easing, presets, inspector, and tests are implemented (README.md:1-45; src/statemotion/panel/package.json:1-20). This is beyond a prototype but **not an end-to-end verified plugin**.

The most serious recorded blocker is Premiere's `StateMotion (AEVideoFilter:11)` low-level render exception. A depth/stride adapter fix was compiled and unit tested, but the release ledger expressly says a fresh in-host operator retest is pending (docs/releases/v0.1-alpha-host-status.md, 'First live Premiere native render test' and 'Native render BLOCKER — root cause + fix'). No current operator evidence in the inspected ledger closes the gate. Major additional source-confirmed quality problems include swallowed parameter-write errors, possible non-atomic parameter writes, silent selection refresh failure, and diagnostics that always report placeholder statuses.

The repository previously contained an **outdated** August 5 audit. It incorrectly describes currently repaired issues: registration test now expects 70 entries (src/statemotion/adobe/statemotion_registration_test.cpp:29-35), preset listing catches per-file failures (src/statemotion/panel/src/domain/presetStorage.ts:101-111), spring/bounce controls exist (src/statemotion/panel/src/ui/inspector.ts:185-260), and README already lists the renderer features (README.md:6-34). These must **not** be treated as open bugs.

No honest numeric percent-complete estimate is possible without measuring end-to-end Adobe host functionality; do not substitute source-code volume for feature completion.

## 2. Build/Run/Test Results

| Check | Result | Evidence |
|---|---|---|
| GitHub repository/file access | PASS | GitHub connector retrieved repository, README, manifest, TypeScript and C++ sources. |
| Terminal clone | **BLOCKED (reproduced October 16)** | Executed `git clone -q https://github.com/Anmol2k5/motion.git /mnt/data/motion-audit`; exact terminal output: `fatal: unable to access 'https://github.com/Anmol2k5/motion.git/': Could not resolve host: github.com`. Exit code 128. |
| Fresh `npm ci`, typecheck, tests, panel build | **NOT RUN** | No local checkout; commands defined at src/statemotion/panel/package.json:8-15. Existing August audit's green outcome is historical, not a fresh result. |
| Fresh C++ tests / SDK native build | **NOT RUN** | No local checkout, Adobe SDK/Premiere host inaccessible in the current runtime. |
| Actual Premiere plugin load/render, panel UX and presets | **NOT VERIFIED** | docs/releases/v0.1-alpha-host-status.md: summary and final 'awaiting operator re-test' status. |
| GitHub Actions CI | NOT ASSESSED | No fresh workflow run performed. |
| Local verification tool availability | PASS | Executed `node --version` → `v22.16.0`; `npm --version` → `10.9.2`; `g++ --version` → `g++ (Debian 14.2.0-19)`; `git --version` → `2.47.3`. **Availability of tools is not proof of build success.** |
| Linter | NOT CONFIGURED in inspected panel package scripts | src/statemotion/panel/package.json:8-15 lists build/typecheck/test but no lint task. |

**Commands required to complete the verification on a Windows workstation with Adobe SDK, VS/MSVC and Premiere Pro 26.3:** `node tools/generate-contract.js --check`; `node tools/generate-contract.test.js`; `cd src/statemotion/panel && npm ci && npm run typecheck && npm test && npm run build`; then run the C++ suites, build the AEX from src/statemotion/adobe/statemotion_effect.sln, install the AEX and load the panel via UXP Developer Tool. Record version, full stdout/stderr, native hash, and video/screenshots of the host test checklist (docs/releases/v0.1-alpha-test-checklist.md). Historical test counts from docs cannot replace these runs.

**Latest source re-check:** Confirmed the silent `writeLogical` rejection handler at `src/statemotion/panel/src/ui/inspector.ts:267-269`, the non-awaited apply/swap/remove UI actions at `:39-64`, stale tab callback at `src/statemotion/panel/src/main.ts:84-89`, destructive malformed metadata fallback at `src/statemotion/panel/src/domain/presetStorage.ts:58-70`, and timestamp-based preset IDs at `:142,162`. The package scripts remain `build`, `typecheck`, `test` without `lint` (`src/statemotion/panel/package.json:8-15`). These are source-confirmed, not runtime reproduced.

## 3. Critical Issues (breaks core functionality)

- [ ] **BLOCKER — In-host render cannot be certified** — docs/releases/v0.1-alpha-host-status.md, 'First live Premiere native render test' and 'Native render BLOCKER' sections. The operator observed AEVideoFilter:11; current patch has only build and unit-test confirmation. **Fix:** rebuild the current AEX, verify installed artifact hash, retest 8-bit and 16-bit video, progress at 0/50/100, resize, crop, alpha, and timeline scrubbing in Premiere; retain host artifacts and close gate only on reproducible evidence.
- [ ] **HIGH — Parameter updates silently lose failures** — src/statemotion/panel/src/ui/inspector.ts:267-269. `writeLogical(...).catch(() => {})` discards errors for virtually all inspector controls. **Fix:** return/await the promise, present inline error and retry state, revert the optimistic UI value, and record contextual diagnostics.
- [ ] **HIGH — Failure during multi-property curve updates can leave partial state** — src/statemotion/panel/src/ui/inspector.ts:174-179. Four independent unawaited writes start from one curve callback. **Fix:** host-side group transaction if supported; otherwise deterministic sequential writes with all-or-nothing recovery/reporting, and integration tests for partial failure.
- [ ] **HIGH — Per-clip bulk actions lack partial-failure UI** — src/statemotion/panel/src/ui/inspector.ts:52-64. Swap/remove loop through supported clips; errors interrupt later clips with no rendered failure summary. **Fix:** disable buttons during work, use per-clip settle/report, render successfully changed vs failed counts, refresh in `finally`.

## 4. Broken / Non-Working Features

- [ ] **HIGH — Host-dependent features not certified** — docs/releases/v0.1-alpha-host-status.md: summary ledger. Actual UXP panel loading, parameter persistence, safe writes, preset apply, undo, and multi-selection remain marked NOT YET VERIFIED; treat as unproven, not as broken. **Fix:** complete corresponding host checklist and attach proofs.
- [ ] **MEDIUM — Diagnostics not live** — src/statemotion/panel/src/main.ts:64-69. `contractStatus: 'unknown'` and `lastOperation: 'none'` are constant, not collected from the adapter. **Fix:** wire a typed telemetry/last-operation state with explicit unknown/error values; test transitions.
- [ ] **MEDIUM — Tab switch can leave stale screen or unhandled rejection** — src/statemotion/panel/src/main.ts:84-89. `refreshSelection().then(...render())` has no rejection handler or stale-request cancellation; rapid switches can render an old tab. **Fix:** monotonic selection request ID or AbortController where supported, `try/catch`, loading state, and stale-result guard.
- [ ] **MEDIUM — Inspector's Apply button does not await or explain outcome** — src/statemotion/panel/src/ui/inspector.ts:39-43. Callback fires an asynchronous apply without capturing result/rejection. **Fix:** async handler, disabled/loading state and success/partial-failure feedback.
- [ ] **MEDIUM — Read failure is disguised as default values** — src/statemotion/panel/src/ui/inspector.ts:95-101. `readConfig` returns an empty typed config on any exception, risking user confidence in fictitious defaults. **Fix:** explicit error state and disable edits until a successful read.

## 5. Hardcoded Values & Mock Data

- [ ] src/statemotion/panel/src/main.ts:24 — `statemotion-panel-data` storage root. Constant may be intentional but should be versioned/configurable for migrations and test isolation.
- [ ] src/statemotion/panel/src/main.ts:66-69 — diagnostic status and last-operation placeholders. Replace with live adapter observations.
- [ ] src/statemotion/panel/src/ui/inspector.ts:107-110 — duplicate static mode/alignment/easing labels. Generate/validate against shared contract to prevent index drift.
- [ ] src/statemotion/panel/src/ui/inspector.ts:185-192 — hardcoded fallback spring/bounce parameters. Match schema defaults automatically and verify native parity.
- [ ] src/statemotion/panel/src/ui/inspector.ts:193,221 — inline `gap:4px` layout styles. Move to CSS spacing tokens for consistent UI.
- [ ] src/statemotion/panel/manifest.json:7-19 — fixed Premiere minimum version and default panel width/height, both intentional release constraints; validate rather than automatically removing.
- [ ] src/statemotion/panel/src/ui/styles.css:2-14 — centralized hardcoded theme values; acceptable design tokens, not mock data.
- [ ] src/statemotion/panel/src/domain/presetStorage.ts:142,162 — timestamp-based imported/duplicate preset IDs. Improve collision resistance with UUIDs; clock resolution is not uniqueness.
- [ ] docs/releases/v0.1-alpha-host-status.md, 'Certification milestone attempt' — stale historic '43 params' claim within a July record; label explicitly historical and add an updated result instead of rewriting the historical observation.
- [ ] Previous AUDIT_REPORT.md: references to `file:///e:/motion` — non-portable report links. Use repository-relative references instead.

## 6. TODO/FIXME Inventory

This audit could not execute a full-repository grep because the clone failed on October 16. No defensible exhaustive TODO/FIXME inventory can be claimed. **Required:** `git grep -nEI 'TODO|FIXME|HACK|XXX|not implemented|placeholder|mock|localhost|127\\.0\\.0\\.1'` from checkout; exclude generated fixture data only after reviewing matches. Record every relevant file:line and disposition. Historical plans and reviews in `.superpowers/` and `docs/` must be labeled as historical if no longer actionable.

## 7. Security & Config Issues

- [ ] **MEDIUM — Silent input/storage loss** — src/statemotion/panel/src/domain/presetStorage.ts:58-70. Malformed `library.json` resets metadata then overwrites the file on init, potentially destroying recoverable favorites/collections. **Fix:** preserve invalid original under timestamped backup, display recovery warning, validate shape before replacing.
- [ ] **MEDIUM — Invalid individual presets are silently skipped** — src/statemotion/panel/src/domain/presetStorage.ts:101-110. Defensive behavior fixes earlier crash, but gives no indication of lost presets. **Fix:** collect filenames/errors (sanitized, no content leakage) and show a non-blocking 'N presets could not be loaded' message.
- [ ] **MEDIUM — Duplicate ID race/collision** — src/statemotion/panel/src/domain/presetStorage.ts:140-145,159-165. Timestamp-based names can collide and no exists check precedes these writes. **Fix:** `crypto.randomUUID()` where UXP supports it or an injected secure ID generator; retry collisions and do not overwrite.
- [ ] **LOW — Secret ignore patterns present** — .gitignore:34-41 excludes `.env`, `*.pem`, `*.key`, secrets and credentials dirs. This is necessary but **not proof of no committed secrets**. Perform `gitleaks detect` or `trufflehog git` against history plus repository grep.
- [ ] **LOW — Narrow UXP permissions** — src/statemotion/panel/manifest.json:9-13 declares plugin-local filesystem, no network, no code generation. Positive least-privilege configuration; verify runtime permissions in Premiere rather than assuming they work.

## 8. UI/UX Issues & Fixes

UI review here is **source-based only**, not a pixel-perfect visual inspection in Adobe's host.

- [ ] **HIGH — No meaningful write failure state** — inspector.ts:267-269. Add per-control pending indicator (150ms delay before spinner), error label beneath row, and transient retry affordance; maintain previous value until write confirmed.
- [ ] **MEDIUM — 11px/10px labels reduce legibility** — src/statemotion/panel/src/ui/styles.css:34,82,111,161. Increase primary labels to 12–13px, tertiary minimum 11px, maintain line-height ~1.4; validate host font rendering at 100%/150% OS scaling.
- [ ] **MEDIUM — Compact target sizing** — src/statemotion/panel/src/ui/styles.css:147-165. Enforce at least 32px button height and 36px on primary actions, 8px minimum inter-control spacing; verify 320px panel width and narrow resizes.
- [ ] **MEDIUM — Tab loading/stale result** — src/statemotion/panel/src/main.ts:84-89. Render skeleton immediately (or after 150ms), lock result to active tab identity, report failures inline. Keep transitions 120–160ms and disable motion for reduced-motion settings.
- [ ] **MEDIUM — Inconsistent mixed inline styling** — src/statemotion/panel/src/ui/inspector.ts:83,170,193,221. Use CSS tokens `--space-1:4px`, `--space-2:8px`, `--space-3:12px`, `--space-4:16px`, 6px control radius.
- [ ] **MEDIUM — Empty selection display exists but error distinction is missing** — src/statemotion/panel/src/ui/inspector.ts:20-32,95-101. Keep current clear empty-state messages, but create a separate host-read-error state to prevent 'nothing selected' from hiding API errors.
- [ ] **LOW — Accessibility needs host testing** — src/statemotion/panel/src/main.ts:21,85-93. Buttons have tablist/tab roles but no demonstrated arrow-key roving focus or `aria-controls`. Implement keyboard tabs, visible focus and screen-reader status announcements after confirming UXP DOM behavior.

## 9. Prioritized Fix Plan

| Priority | Work | Effort | Release gate |
|---|---|---|---|
| Critical | Rebuild/reinstall AEX, capture real Premiere render proof for all smoke cases | Rework | Required |
| Critical | Verify native/panel contract, persistence and preset write paths in Premiere | Rework | Required |
| High | Await parameter writes; show failures; prevent partial writes | Moderate | Required |
| High | Add bulk apply/remove/swap failure handling and targeted regression tests | Moderate | Required |
| High | Turn unknown diagnostics into real tracked state | Moderate | Recommended |
| Medium | Fix tab race/rejected promise and read error fallback | Quick–moderate | Recommended |
| Medium | Preserve malformed library metadata, warn on skipped presets | Moderate | Recommended |
| Medium | Audit preset ID generation/migration and collision prevention | Quick | Recommended |
| Medium | Fresh `npm ci`/typecheck/test/build, C++ compile and lint/security scan | Moderate | Required |
| Low | Panel typography, keyboard tabs, spacing, responsiveness | Moderate | Recommended |
| Low | CI automation, add ESLint and cross-platform build instructions | Moderate | Recommended |
| Low | Correct historical audit links and reconcile status documents | Quick | Recommended |

## 10. Nice-to-haves

- Visual regression screenshots under Premiere UXP at 320/420/600px widths and 100/150/200% DPI, with explicit approval baselines (manifest.json:15-19).
- A dedicated scripted release verifier that logs contract check, TS tests, C++ tests, native DLL/AEX hash, UXP bundle manifest, and host operator sign-off (README.md:47-67; docs/releases/v0.1-alpha-test-checklist.md).
- Test injection/fault scenarios for host write failures, rejected selection reads and corrupted preset metadata (inspector.ts:267-269; main.ts:84-89; presetStorage.ts:58-70).
- Automated license/dependency audit and historical secret scan; report clean findings only when scanners actually execute.
- Operator-recorded CPU render benchmarks on 1080p/4K clips with crop/shadow/glow/blur enabled, to establish performance budgets before optimizing.

---
**Audit integrity note:** Source-backed issues are confirmed at cited file lines; no panel build, native compile, fresh unit tests, real Premiere run, exhaustive repository grep, or visual render was executed in this environment. Treat this as a **source audit + runtime certification plan**, not as a completed end-to-end functional verification.