# Research Ticket 006 — Effect Timing Information Inside the Render Call

**Project:** StateMotion (clean-room Premiere/After Effects effect)
**Ticket:** `006-effect-timing-information`
**Question:** How does a native AE/Premiere effect obtain timing inside `PF_Cmd_RENDER` — clip-local time, clip in/out/duration, sequence time, frame rate — and how does it detect speed/reverse/freeze/trim/nested-sequence changes?
**Scope:** Research only. No production code, no commercial inspection.

---

## 1. Question Restated

StateMotion's ProgressEngine (spec §9) must compute a normalized progress value for an effect across its clip's lifetime, correctly handling reverse-speed, freeze-frame, and nested sequences. This ticket establishes what timing data a native effect actually *receives* from the host vs. what it must query, and what is simply unavailable from the effect's render context.

---

## 2. Sources

- **S1** `PF_InData` — https://ae-plugins.docsforadobe.dev/effect-basics/PF_InData/  (AE C++ SDK Guide)
- **S2** `Command Selectors` — https://ae-plugins.docsforadobe.dev/effect-basics/command-selectors/
- **S3** `Tips & Tricks` (time params) — https://ae-plugins.docsforadobe.dev/effect-details/tips-tricks/
- **S4** `Basic Host Differences` (Premiere) — https://ae-plugins.docsforadobe.dev/ppro/basic-host-differences/
- **S5** `Premiere Pro & Other Hosts` — https://ae-plugins.docsforadobe.dev/ppro/ppro/
- **S6** `PrSDKAESupport.h` `PF_UtilitySuite` (Rust mirror, authoritative field names) — https://docs.rs/premiere-sys/latest/premiere_sys/struct.PF_UtilitySuite.html and `PF_UtilitySuite13` https://docs.rs/premiere-sys/latest/premiere_sys/struct.PF_UtilitySuite13.html
- **S7** Exporter suites `GetClipSpeed()` — https://ppro-plugins.docsforadobe.dev/exporters/suites/
- **S8** `PrSDKVideoSegmentSuite` (node time transform) — https://docs.rs/premiere-sys/latest/premiere_sys/struct.PrSDKVideoSegmentSuite.html
- **S9** GPU `PrGPUFilterRenderParams` (`inClipTime`/`inSequenceTime`) — https://ppro-plugins.docsforadobe.dev/gpu-effects-transitions/structure-descriptions/
- **S10** Community: AE filter `GetClipSpeed` advantage over PPro video filter API — https://community.adobe.com/questions-729/videorecord-part-and-speed-duration-1368710
- **S11** Community: nested-sequence reverse speed black-footage regression — https://community.adobe.com/questions-729/premiere-pro-cc-nested-sequence-reverse-speed-makes-black-footage-1375759
- **S12** Community: `GetClipDuration` crash regression in 26.5 Beta — https://community.adobe.com/bug-reports-733/premiere-26-5-beta-30-regression-causes-spurious-crashes-when-third-party-plugins-invoke-pf-utilitysuite4-getclipduration-1627652
- **S13** ExtendScript `clip.getSpeed()` returns negative for reverse, 0 for freeze — Adobe Premiere Pro scripting (ExtendScript) `TrackItem.getSpeed()` docs (community examples referenced in S6 GitHub MCP commit).

---

## 3. Confirmed Facts

### 3.1 Render entry point and time fields (S1, S2)
- All AE-effect communication is via the single entry point `main(cmd, in_data, out_data, params, output, extra)`. `PF_Cmd_RENDER` (or `PF_Cmd_SMART_RENDER`) is the render call. **All** `PF_InData` fields are valid during `PF_Cmd_RENDER`.
- The host populates `PF_InData` *before* each selector. Timing is exposed through five fields:
  - `current_time` — time of the frame being rendered. **In the layer (clip) time system, NOT the comp/sequence.** Valid during `PF_Cmd_RENDER`.
  - `time_step` — duration of the current source frame (seconds = `time_step / time_scale`). Can be **negative** (time-reversed) and can be **0** (nested, PFR off). Guard against divide-by-zero.
  - `local_time_step` — constant time between layer frames (seconds = `local_time_step / time_scale`). Affected only by time stretch; can be negative if reversed; never zero.
  - `total_time` — layer (clip) duration (seconds = `total_time / time_scale`).
  - `time_scale` — units per second for all of the above. In Premiere the scale differs from AE (e.g. NTSC: `time_scale=60000, time_step=1001`); **never hard-code** (S4).
- `current_time` may be non-integral and even negative (CS3+). The current frame index is `current_time / time_step` (S1).

### 3.2 Clip-local vs. sequence (comp) time (S1, S2, S3)
- **`current_time` is clip-local** (layer time): "the current time in the layer, not in any composition." When a layer starts at non-zero time or is time-stretched, layer time ≠ comp/sequence time. This is exactly the "clip-local time relative to clip in point" the ticket asks about: the effect receives it **directly** as `current_time`, not the sequence time.
- The effect **does not receive sequence/comp time in `PF_InData`** for the AE effect API. (AE has no "sequence time"; it has comp time, which `current_time` is explicitly *not*.)
- In **Premiere**, the AE-effect `PF_InData` still gives clip-local `current_time`/`time_step`/etc. The **GPU** effect API (S9) is the only place `inSequenceTime` and `inClipTime` are both passed in one struct (`PrGPUFilterRenderParams`): `inClipTime` = "time of current render, relative to clip start"; `inSequenceTime` = "relative to sequence start". So for a GPU-accelerated transition/effect the host *does* hand both. For the CPU/AE-effect path the sequence time must be queried separately (see 3.4).

### 3.3 Derived quantities
- Clip-local progress (fraction of clip lifetime): `current_time / total_time` (both in `time_scale` units). This is the natural ProgressEngine input for a *constant-speed, non-reversed* clip.
- Source-media frame: use `local_time_step` to locate frames; `time_step` when checking out params/input at other times (S3). With nested/PFR-off, `time_step` may be 0 or vary per frame.

### 3.4 Clip attributes — what the effect can observe (S4, S6, S7, S10, S13)
Premiere exposes a **Premiere-specific `PF_UtilitySuite`** (defined in `PrSDKAESupport.h`, available to AE effects running in Premiere). No AEGP calls are supported in Premiere (S4). Relevant getters (all take `effect_ref`):
- `GetClipSpeed(effect_ref, double* speed)` — **speed multiplier**. Per S13/ExtendScript semantics and S10, negative `speed` ⇒ **reverse playback**; `0` ⇒ **freeze frame**; `1.0` ⇒ normal. (Adobe scripting `getSpeed()` returns -100% for reverse, 0 for hold/freeze.)
- `GetClipDuration` / `GetClipStart` — scaled (speed-affected) clip duration/start, in ticks.
- `GetUnscaledClipDuration` / `GetUnscaledClipStart` — original media duration/start, **unaffected by speed/retiming** (S6 doc comment).
- `GetTrackItemStart` — track-item start.
- `GetMediaFrameRate(effect_ref, PrTime* ticksPerFrame)` — **source media frame rate**.
- `GetOriginalClipFrameRate` / `GetOriginalClipFrameRateForSourceTrack` — original clip fps.
- `GetMediaFieldType` — field order.
- `GetSequenceTime(effect_ref, PrTime* seqTime)` — **sequence time** for the current render (S6). This is how an AE-effect-in-Premiere obtains the sequence time not present in `PF_InData`.
- `GetContainingTimelineID` — distinguishes nested vs. top-level sequence (a clip inside a nested sequence has a different containing timeline ID than the master sequence).
- `IsMediaTrimmed` / `IsSourceTrackMediaTrimmed` — whether trim/ripple-trim is applied (S6 `PrSDKVideoSegmentSuite` area).
- `GetSequenceDuration` — full sequence duration.
- These parallel `PF_UtilitySuite` in `after_effects_sys` too, but the *clip-speed / clip-start / sequence-time* functions are Premiere-specific (`PrSDKAESupport.h`).

### 3.5 Reverse / freeze / nested via node time transform (S8)
- `PrSDKVideoSegmentSuite` (GPU path; `inTimelineID`/`inNodeID` in `PrGPUFilterInstance`) provides:
  - `TransformNodeTime(nodeID, inTime, outTime)` — maps a clip-node local time → media/effect time, **accounting for speed change, reverse, and time remapping**. If no transform, returns input unchanged.
  - `GetNodeRate(nodeID, inTime, outRate)` — instantaneous time rate of a node (varies with time remapping; not with sequence playback speed).
  - `GetVideoSegmentsProperties` — bounds, PAR, frame rate, field type of the segment.
- This is the robust way to map clip-local time → media time under arbitrary speed/remap, but it is exposed through the **GPU/segment suites**, not the basic `PF_InData`. Availability on adjustment layers is known-buggy (S: community DVAAP-3508).

### 3.6 Frame rate / fps (S1, S4, S6)
- **Sequence/comp frame rate:** encode in `time_scale` (units per second) + `time_step`/`local_time_step`. fps = `time_scale / time_step` (per-frame) or `time_scale / local_time_step` (layer). Note Premiere uses large scales (e.g. 60000) so compute the ratio, never assume 30.
- **Source media frame rate:** `PF_UtilitySuite.GetMediaFrameRate()` (Premiere) returns `PrTime` ticks-per-frame. In AE, "a layer's intrinsic frame rate is not visible anywhere" (S3) — only derivable if same fps as comp with no stretch/remap.
- Field type via `PF_InData.field` and `GetMediaFieldType`.

---

## 4. Answers to the Four Verification Points

**Q1. Which selectors/suites expose current render time, layer time, comp/sequence time?**
- `PF_Cmd_RENDER` (+ `PF_Cmd_SMART_RENDER`) with `PF_InData`: `current_time` (layer/clip time), `time_step`, `local_time_step`, `total_time`, `time_scale` (S1, S2).
- Layer time = `current_time`. **Comp/sequence time is NOT in `PF_InData` for the AE effect API**; in Premiere obtain via `PF_UtilitySuite.GetSequenceTime()` (S6) or, on the GPU path, `PrGPUFilterRenderParams.inSequenceTime` (S9).
- AEGP suites (AE only) can read comp time, but **AEGP is unavailable in Premiere** (S4).

**Q2. Clip-local vs. sequence time — directly available or computed?**
- **Clip-local time is directly available** as `current_time` (clip layer time). Sequence time is NOT in `PF_InData`; must be queried (`GetSequenceTime`) or, for GPU effects, taken from `inSequenceTime`. The effect receives clip-local directly; it computes progress as `current_time/total_time`.

**Q3. Detecting speed/reverse/freeze/trim/nested — observable from effect or only UXP/host?**
- **From the effect (Premiere), via `PF_UtilitySuite` (`PrSDKAESupport.h`):** `GetClipSpeed` (sign ⇒ reverse/freeze; magnitude ⇒ speed), `GetClipDuration`/`GetUnscaledClipDuration` (trim/speed effect), `GetClipStart`/`GetUnscaledClipStart`, `GetContainingTimelineID` (nested-sequence detection), `IsMediaTrimmed`, and `PrSDKVideoSegmentSuite.TransformNodeTime` (reverse + remap mapping).
- These are **Premiere-only**; the pure-AE API (`PF_InData`) exposes only time *stretch* signs via `time_step`/`local_time_step` negativity and PFR behavior (S3). AE detects reverse via negative `time_step`; freeze (hold) via `time_step == 0` only in nested/PFR-off cases. Speed magnitude, trim, and nesting are otherwise **not observable from a pure AE effect** and would need AEGP (AE) or the Premiere `PF_UtilitySuite`.
- UXP/ExtendScript panel can read all of this (`clip.getSpeed()`, `clip.start`, `clip.duration`, speed ramps) but that is a separate process; the *effect render* does not need UXP for the basic cases.

**Q4. Frame rate / fps via which suite?**
- Sequence fps: derived from `time_scale` / `time_step` (per-frame) or `time_scale` / `local_time_step` (layer) in `PF_InData` — no separate suite needed (S1).
- Source media fps: `PF_UtilitySuite.GetMediaFrameRate()` (Premiere, `PrSDKAESupport.h`) and `GetOriginalClipFrameRate()` (S6). In AE, intrinsic media fps is explicitly **not exposed** (S3).

---

## 5. Assumptions
- A1: StateMotion targets **Premiere Pro** primarily (clean-room Premiere effect), so `PrSDKAESupport.h` `PF_UtilitySuite` is available. If it must also run in pure AE, the speed/reverse/trim detection in Q3 has gaps (AEGP needed).
- A2: `GetClipSpeed` sign convention (negative = reverse, 0 = freeze) mirrors the documented ExtendScript `getSpeed()` behavior and S10 community description. **Not explicitly stated in the C SDK docs** — verify against `PrSDKAESupport.h` header in the actual SDK before relying on it.
- A3: `current_time` is clip-local in both AE and Premiere hosts (confirmed by S1/S4).
- A4: GPU-accelerated path is optional; the CPU AE-effect path is the baseline for ProgressEngine.

## 6. Contradictions / Risks
- **C1 (regression S12):** `PF_UtilitySuite4.GetClipDuration()` crashes in Premiere 26.5 Beta when called during `PF_Cmd_PARAMS_SETUP`. Avoid calling clip-duration/speed queries at params-setup; query at render time instead.
- **C2 (S11):** Nested-sequence reverse speed can produce black footage in some Premiere versions — a host bug, not an effect bug, but means ProgressEngine cannot assume valid frames for reversed nested clips.
- **C3 (S10):** The native Premiere *video filter* API (`fsExecute`/`VideoRecord.part`) does NOT expose clip speed; only the **AE-effect API inside Premiere** gets `GetClipSpeed`. Confirms StateMotion should be built as an **AE-compatible effect** (not a legacy PPro video filter) to access timing.
- **C4:** `time_step` can be 0 (nested, PFR off) — naive `current_time/time_step` frame math divides by zero. ProgressEngine must prefer `current_time/total_time` or guard.

## 7. Recommendation
1. Build StateMotion as an **AE-effect plugin** (so it runs in both AE and Premiere and gains `PrSDKAESupport.h` `PF_UtilitySuite` in Premiere). Avoid the legacy PPro `fsExecute` video-filter API (C3).
2. **Baseline progress** = `current_time / total_time` (clip-local, robust, no division by `time_step`).
3. At render time, call `PF_UtilitySuite.GetClipSpeed()` to get `speed`: if `speed < 0` ⇒ reversed (ProgressEngine should mirror progress or flag reverse); if `speed == 0` ⇒ freeze (progress constant); magnitude scales the duration mapping. Prefer `GetUnscaledClipDuration` for true media length.
4. For nested sequences, use `GetContainingTimelineID()` to detect nesting; if precise media mapping is needed, use `PrSDKVideoSegmentSuite.TransformNodeTime` (GPU path) — but note adjustment-layer gap (S: DVAAP-3508).
5. Compute fps from `time_scale/time_step` ratio; do **not** hard-code scales (S4). For source fps use `GetMediaFrameRate`.
6. Guard all `time_step` divisions; accept non-integral/negative `current_time`.
7. Query timing only during `PF_Cmd_RENDER`/`FRAME_SETUP`, never `PARAMS_SETUP` (C1).

## 8. Impact on Spec (ProgressEngine §9)
- The spec's reverse-speed / freeze-frame / nested-sequence claims are **achievable** for a Premiere-targeted AE effect: `GetClipSpeed` sign + `GetContainingTimelineID` + clip-local `current_time` provide the needed signals.
- **Caveat:** In pure AE (no Premiere `PF_UtilitySuite`), reverse/trim/speed-magnitude are *not* directly observable except via negative `time_step` (reverse only) — so the spec's strongest claims should be scoped to "Premiere host (or AE + AEGP)". Recommend the spec state the host prerequisite explicitly.
- ProgressEngine must not assume frame-aligned `current_time` and must handle `time_step == 0` and negative values.

## 9. Follow-ups
- F1: Confirm `GetClipSpeed` sign convention against the actual `PrSDKAESupport.h` in the Adobe SDK (header inspection, not commercial code disassembly — header is publicly shipped in SDK).
- F2: Determine whether StateMotion must support pure-AE host (AEGP) or Premiere-only; this bounds the reverse/freeze detection capability.
- F3: Verify `PrSDKVideoSegmentSuite` availability/behavior for adjustment-layer-applied effects (DVAAP-3508) before relying on it for nested sequences.
- F4: Test `GetClipSpeed`/timing queries at `FRAME_SETUP` vs `RENDER` to avoid the 26.5 PARAMS_SETUP crash (C1).
- F5: Confirm `PF_Cmd_SMART_RENDER` path gives identical timing fields (needed if 32-bit / SmartFX is used).
