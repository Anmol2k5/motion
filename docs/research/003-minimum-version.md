# Research: Minimum Premiere Pro Version & UXP Manifest Version

- Ticket: `003-minimum-premiere-version`
- Date: 2026-07-17
- Method: websearch + webfetch of Adobe PRIMARY sources (developer.adobe.com, docsforadobe.dev, blog.developer.adobe.com, Adobe GitHub docs commits).

## Question Investigated

Determine the minimum supported Premiere Pro version and UXP manifest version for the
combined StateMotion product (native AE/PR effect plugin + UXP Hybrid panel), and verify
the spec's "26.3+" minimum claim.

## Sources (pinned)

- Adobe Premiere UXP Changelog — https://developer.adobe.com/premiere-pro/uxp/changelog/
- Adobe Premiere UXP Introduction — https://developer.adobe.com/premiere-pro/uxp/introduction/
- Adobe Premiere UXP "Building your first plugin" — https://developer.adobe.com/premiere-pro/uxp/plugins/
- Adobe Premiere UXP Plugin Manifest — https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/manifest/
- Adobe Premiere UXP Hybrid Plugins Overview — https://developer.adobe.com/premiere-pro/uxp/plugins/hybrid-plugins/
- Adobe Premiere UXP Building Hybrid Plugins — https://developer.adobe.com/premiere-pro/uxp/plugins/hybrid-plugins/build
- Blog: "UXP Arrives in Premiere" (official, 2025-12-01) — https://blog.developer.adobe.com/en/publish/2025/12/uxp-arrives-in-premiere-a-new-era-for-plugin-development
- Blog: "UXP-Hybrid Plugins now available for Premiere" (official, 2026-04-01) — https://blog.developer.adobe.com/en/publish/2026/04/uxp-hybrid-plugins-now-available-for-premiere
- Adobe Premiere desktop release notes — https://helpx.adobe.com/premiere/desktop/whats-new/release-notes.html
- Premiere Pro C++ SDK Guide (what's new) — https://ppro-plugins.docsforadobe.dev/intro/whats-new/
- After Effects C++ SDK Guide — https://ae-plugins.docsforadobe.dev/intro/whats-new/
- Community: signing requirement as of 25.2 — https://community.adobe.com/questions-529/new-signing-requirement-for-ae-and-pr-extensions-as-of-25-2-0-59858

## Confirmed Facts

### 1. When did Premiere UXP officially ship? → 25.6 (SPEC CLAIM CORRECT)
- UXP officially graduated from beta and shipped in **Premiere Pro 25.6** (Nov 2025).
- Beta (public) started at **25.2** (Dec 2024); earlier 25.1 beta existed.
- Source: UXP Changelog "Official Release of UXP extensibility in Premiere Pro" under v25.6.0;
  Blog "UXP Arrives in Premiere" dated 2025-12-01; introduction page: "Premiere (version 25.6)".
- UXP Developer Tool v2.2 introduced for the 25.6 official release.

### 2. When did UXP Hybrid plugins arrive? → 26.2 (SPEC CLAIM CORRECT)
- UXP **Hybrid Plugins** (UXP + native C++ `.uxpaddon`) officially arrived in **Premiere Pro 26.2**
  (April 2026).
- Source: UXP Changelog v26.2.0 "UXP Hybrid Plugin Support"; Blog "UXP-Hybrid Plugins now
  available for Premiere" (2026-04-01): "available for Adobe Premiere (version 26.2)".
- Hybrid Plugin SDK is versioned independently of the host (labeled with a UXP version).

### 3. What UXP manifest version corresponds to Premiere 26.3? Is v6 valid/required? (SPEC CLAIM PARTIALLY WRONG)
- **26.3 is NOT tied to manifest v6, and 26.3 is NOT required as a host minimum.**
- The Adobe Hybrid build guide's OWN sample manifest uses:
  ```json
  {
    "manifestVersion": 6,
    "host": { "app": "premierepro", "minVersion": "25.6.0" },
    "addon": { "name": "sample-uxp-addon.uxpaddon" },
    "requiredPermissions": { "enableAddon": true }
  }
  ```
  i.e. `manifestVersion: 6` with host `minVersion: 25.6.0`. (Source: hybrid-plugins/build)
- `manifestVersion` 5 is the baseline Premiere supports for ordinary UXP plugins
  (Source: manifest page "Premiere supports version 5").
- `manifestVersion` **6** is required ONLY when the plugin uses **Hybrid addon** features
  (`addon` field + `enableAddon` permission). It is NOT a Premiere-26.3-specific schema.
- Therefore: manifest v6 is valid and REQUIRED for the Hybrid (native-addon) part of StateMotion,
  but it does not force the host minVersion to 26.3 — Adobe's own example sets 25.6.0.

### 4. Hard blocker forcing 26.3 as minimum? → NO, convenience / forward-looking
- There is **no hard blocker** that requires 26.3 as the minimum for a combined
  native-effect + UXP Hybrid product.
- The Hybrid capability exists from **26.2**, and the manifest example runs at **25.6**.
- 26.3 (May/June 2026) is notable for **breaking changes**, not new required baseline features
  for Hybrid:
  - `Sequence.setSelection` became synchronous (was async/Promise).
  - Action creation must now occur inside `project.lockedAccess(...)`.
  - New APIs added (ObjectMaskUtils, createSubClipAction, EncoderManager exports, ProjectConverter.exportAAF, etc.).
- So 26.3 is a version StateMotion should *target/test against* because of the breaking changes
  (avoid the old async setSelection pattern), but it is **not a floor** imposed by the platform.
- Setting min to 26.3 would simply exclude 25.6–26.2 users with no technical necessity
  (assuming we don't depend on a 26.3-only API).

### 5. Does AE/PR Effect SDK impose a minimum Premiere version independent of UXP? → NO
- The After Effects / Premiere Pro **C++ Effect SDK** has NO minimum Premiere version tied to UXP.
  - Premiere Pro loads a **subset of the AE API**; the AE SDK is not even bundled in the PR SDK.
  - Native effects compile against the AE/PR SDK headers; they load in essentially any modern
    Premiere that supports the AE-effect subset (long-standing, version-independent mechanism).
  - Effect API version is decoupled (e.g., AE SDK 25.6 added WinARM-native; the API version
    numbering is independent of Premiere's 25.x/26.x marketing version).
- The only version-relevant native constraint is a **code-signing requirement introduced at
  Premiere/AE 25.2**: unsigned native bundles fail to load (error ~2685337601). This affects
  the native `.plugin`/`.prm` effect, not the UXP/Hybrid layer, and it is a *signing* rule,
  not a *minimum-version* rule (it applies at 25.2+).
- Conclusion: native effect minimum version is governed by (a) the SDK you compile with and
  (b) the signing rule from 25.2 — NOT by UXP or by 26.3.

## Assumptions

- StateMotion's combined product = native AE/PR effect plugin (C++/PiPL or new entry-point
  registration) + UXP Hybrid panel (JS UI + `.uxpaddon` native addon).
- "Manifest v6" in the spec refers to UXP `manifestVersion`, not the AE effect API version.
- We do not strictly require any 26.3-only API (ObjectMaskUtils, exportAAF, etc.) for v1 scope.
- Release timing: 25.6 = Nov 2025, 26.2 = April 2026, 26.3 = ~May/June 2026 (per changelog
  commit dates and release notes).

## Contradictions / Corrections to Spec

- Spec claims minimum **26.3+** with **manifest v6**.
  - Manifest v6 claim: **Correct** (v6 required for Hybrid addon support).
  - 26.3+ claim: **Not supported by evidence.** The platform enables the combined product at
    **26.2** (Hybrid) / **25.6** (UXP baseline). Adobe's own Hybrid sample uses minVersion 25.6.0.
    26.3 only adds breaking changes + new optional APIs.
- No source ties manifest v6 to 26.3; the two are orthogonal (v6 = Hybrid feature flag,
  host minVersion = independent field).

## Recommendation

- **Minimum Premiere Pro version: 26.2** for the combined product (the earliest version that
  supports UXP Hybrid, which StateMotion needs for the native-addon + UXP panel combination).
  - If the UXP panel can ship WITHOUT the native `.uxpaddon` in v1 (pure UXP panel + separately
    installed native effect), the UXP floor could be **25.6**; but the *combined* experience
    needs 26.2.
  - Do NOT set the floor to 26.3 unless a 26.3-only API becomes a hard dependency.
- **UXP manifest version: `manifestVersion: 6`** (required because StateMotion uses Hybrid
  addons), with `requiredPermissions.enableAddon: true` and the `addon` field.
  - Host `minVersion` in the manifest should be **`"26.2.0"`** (or `"25.6.0"` if decoupling
    the UXP panel from the addon), NOT `"26.3.0"`.
- **Native effect (AE/PR SDK):** compile against current SDK; ensure code-signing compliance
  (required since 25.2). No UXP-driven minimum version applies.

## Impact on Spec

- The spec's "26.3+" minimum should be lowered to **26.2** (or 25.6 if UXP panel is decoupled
  from the addon), unless a 26.3-only API is adopted.
- Keep `manifestVersion: 6` but correct the association: it is the Hybrid-addon requirement,
  independent of host 26.3.
- Add a note: 26.3 has breaking UXP API changes (sync `setSelection`, `lockedAccess` for
  Actions) — code must target the 26.3 API shape even if min version is 26.2.

## Follow-ups

- Confirm v1 scope: is the native `.uxpaddon` required at launch, or can the effect ship as a
  standalone signed PR/AE plugin with the UXP panel added later? (Decides 25.6 vs 26.2 floor.)
- Verify whether the UXP Hybrid SDK's current downloadable build sets any *additional*
  `minVersion` constraint in its README (SDK is independently versioned; recheck at build time).
- Decide whether to adopt (and thus require) any 26.3-only API; if not, keep min at 26.2.
- Track Adobe Marketplace packaging rule: Hybrid `.ccx` requires all three architectures
  (macOS arm64, macOS x64, Windows x64) or the portal rejects it (relevant to 010-host-test /
  019-first-release-scope).
