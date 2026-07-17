# Research: 009-install-sign-package
## Plugin installation, signing, packaging & distribution (native effect + UXP panel)

- **Ticket:** 009-install-sign-package
- **Scope:** Combined native effect (MediaCore `.prm`/`.bundle` + UXP hybrid `.uxpaddon`) and UXP panel, on Windows + macOS.
- **Method:** Primary Adobe sources (developer.adobe.com UXP for Premiere, Premiere C++ SDK install guide, UXP branding/distribution docs) + one community confirmation. No commercial or decompiled material was inspected.

---

## 1. Where Premiere loads native effect binaries from (MediaCore)

**Confirmed facts**

- Premiere loads native plugins (effects/importers/etc.) from the **common MediaCore plugin directory**, shared across Premiere Pro, After Effects, Audition, and Media Encoder.
- **Windows:** `C:\Program Files\Adobe\Common\Plugins\7.0\MediaCore\`
  - Also reachable via registry key `HKEY_LOCAL_MACHINE\Software\Adobe\Premiere Pro\<ver>\CommonPluginInstallPath`.
  - As of Premiere v22.0 the folder was renamed `\Plugins` (was `\Plug-Ins`); legacy `\Plug-Ins` is still probed.
- **macOS:** `/Library/Application Support/Adobe/Common/Plugins/7.0/MediaCore/` (system-level, i.e. the **root** `/Library`, not `~/Library`).
- **User-level vs system-level:** The documented common location is **system-level** (`Program Files`, `/Library/...`). This is the supported, shared location. Per the C++ SDK guide, plugins should be installed there (and following macOS code-signing guidance, plugins should *not* be placed inside the app bundle). There is no documented supported *user-level* MediaCore path for native effect binaries — user-level install is the UXP/panel layer (see §2), not the native effect layer.
- **File extensions:** Windows effect plugin = `.prm`; macOS = `.bundle`. VST = `.dll`, After Effects = `.aex`. A UXP *hybrid* native component is a `.uxpaddon` (a renamed `.dll` on Windows / `.dylib` on macOS) bundled *inside* the UXP plugin, loaded via `require(...)`, not placed in MediaCore directly.

**Sources**
- https://ppro-plugins.docsforadobe.dev/intro/plugin-installation (Premiere Pro C++ SDK Guide — Plug In Installation)
- https://github.com/docsforadobe/premiere-plugin-guide/blob/master/docs/intro/plugin-installation.md
- https://community.adobe.com/questions-529/... (community confirmation of MediaCore paths, Feb 2026)

**Assumptions / contradictions**
- Premiere UXP hybrid `.uxpaddon` native code is delivered *inside the UXP `.ccx`*, not via MediaCore. The native "effect" in this combined plugin is therefore the UXP addon (hybrid), not a separate MediaCore `.prm`. The spec's §21 may conflate "native effect" with "hybrid addon" — see Impact below.
- No evidence of a supported per-user MediaCore folder; if the spec claims user-level native install, that needs correction.

---

## 2. How a UXP panel/plugin is installed

**Confirmed facts**

- **Dev mode (local testing):** Enable *Developer Mode* in Premiere (Settings → Plugins → Enable developer mode), then load the plugin folder via the **UXP Developer Tool (UDT v2.2+)**. UDT requires administrator privileges. No packaging needed for dev.
- **Packaged distribution format:** UXP plugins are packaged as **`.ccx`** files (a ZIP under the hood). For Premiere/UXP, the supported Adobe packaging route is `.ccx` produced by UDT's *Package* action. The older `.zxp`/CEP signing is **not** used; UXP `.ccx` does **not** require a digital signature/timestamp on the package itself (unlike CEP `.zxp`).
  - NOTE: ticket text referenced `.uxpaddon` as the package; `.uxpaddon` is the **native binary** inside the bundle, not the install package. The install package is `.ccx`.
- **Installation channels:**
  - *Creative Cloud Marketplace* — installed via Creative Cloud Desktop app; requires Adobe review/approval; free or paid.
  - *Direct / independent distribution* — double-click the `.ccx` (opens Creative Cloud Desktop; shows an "not verified by Adobe" warning; user clicks Install). No Adobe review required. Can also use the **UPIA** (Unified Plugin Installer Agent) CLI.
  - *Enterprise* — Admin Console or UPIA.
- **Hybrid plugins** (native + UXP) follow the same `.ccx` workflow, with extra steps: correct `mac/`+`win/`+`arm64`/`x64` directory layout, all required architectures built, macOS signing/notarization, then package via UDT.
- **Admin credentials:** Because hybrid plugins include native code, the user is **prompted for OS administrator credentials** during install/update.
- **Premiere panel location:** Window → **UXP Plugins** menu.

**Sources**
- https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/package/
- https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/install/
- https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/overview
- https://developer.adobe.com/premiere-pro/uxp/plugins/hybrid-plugins/build
- https://developer.adobe.com/premiere-pro/uxp/plugins/hybrid-plugins/faq
- https://developer.adobe.com/premiere-pro/uxp/plugins/ (getting started / dev mode)

---

## 3. Code-signing: mandatory for testing, or only distribution?

**Confirmed facts**

- **macOS (hybrid `.uxpaddon`):** The macOS `.uxpaddon` executables **must** be signed and notarized with a valid **Apple Developer ID** certificate. Self-signed/test certificates are **not accepted**; cert must be valid ≥ 1 year. Only the `.uxpaddon` binaries need signing — JS/HTML/CSS/manifest do not. Hardened Runtime is required for notarization (Apple notarization requires the Hardened Runtime entitlement posture).
  - This signing/notarization is required for **distribution**, not for local dev loading via UDT. UDT dev loading does not require notarization; the macOS Gatekeeper/security warning ("binaries trigger security warnings") appears on un-notarized binaries in real installs. For clean-machine `.ccx` testing, signing is needed to avoid warnings/load failures.
- **Windows (native DLL / `.uxpaddon`):** Adobe's UXP hybrid docs emphasize **macOS** signing and do **not** state a Windows Authenticode requirement for the `.uxpaddon`. However: (a) the ticket's assumption of Windows Authenticode for the native DLL is reasonable per general Windows practice, and (b) the C++ SDK FAQ notes Debug-built binaries fail on clean Windows because of missing VS debug runtimes — implying a **Release** build is required for distribution. Adobe does not, in the reviewed UXP docs, mandate Authenticode for the `.uxpaddon`, but SmartScreen/trust warnings on unsigned executables are a real-world distribution concern. Treat Windows Authenticode as **recommended/best-practice for distribution, not mandated by Adobe's UXP hybrid docs** — needs confirmation if strict compliance is required.
- **UXP `.ccx` package itself:** No code signature/timestamp required (contrast CEP `.zxp`).

**Sources**
- https://developer.adobe.com/premiere-pro/uxp/plugins/hybrid-plugins/faq ("Do I need to code sign the entire plugin bundle?" → only macOS `.uxpaddon`; "Do I need an Apple Developer ID?" → Yes)
- https://developer.adobe.com/premiere-pro/uxp/plugins/hybrid-plugins/build (§3 Code sign and notarize macOS)
- https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/package/ (no package signature needed)

**Assumptions / contradictions**
- Ticket assumes Windows Authenticode is mandatory for the native DLL. Adobe UXP hybrid docs only *mandate* macOS signing+notarization. Windows Authenticode is not stated as mandatory in the reviewed sources — flag as an open item for the spec.
- Hardened Runtime is an Apple notarization prerequisite (well established) but not separately called out in the UXP docs; it is implied by "sign and notarize."

---

## 4. Preserving user presets across upgrades

**Confirmed facts**

- UXP provides a **Data folder** (`require('uxp').storage.localFileSystem.getDataFolder()`) that is:
  - Persistent **across host-app version upgrades AND across plugin updates**.
  - Accessible without a file-picker (no user interaction).
  - Distinct from the read-only Plugin folder and the transitory Temporary folder.
- Sandbox model: with `localFileSystem: "plugin"` (default), the plugin can always read/write its **installation dir, data folder, temp folder**. The Data folder is the correct place for user presets/settings that must survive upgrades.
- The **Plugin folder** is read-only (packaged assets) — do NOT store user presets there (they are wiped on update).
- **Important caveat:** The Data folder is removed on **uninstall** or if the user clears it. Adobe recommends giving users an option to back up critical data to a location of their choice.
- Storage URI schemes available: `plugin:`, `plugin-data:`, `plugin-temp:`, plus native `file:`. `plugin-data:` maps to the persistent data folder.
- For hybrid plugins, file-system access is *relaxed* — direct native paths work — so presets could also live at an explicit user-chosen path; but the sanctioned persistent location is the data folder.

**Sources**
- https://developer.adobe.com/premiere-pro/uxp/resources/recipes/filesystem-operations/ (sandbox: Data folder persistent across upgrades, removed on uninstall)
- https://adobedocs.github.io/uxp-photoshop/uxp-api/reference-js/Modules/uxp/Persistent%20File%20Storage/FileSystemProvider/ (`getDataFolder()` persistent across host-app upgrades)
- https://developer.adobe.com/photoshop/uxp/2022/uxp-api/reference-js/modules/uxp/persistent-file-storage/storage (schemes `plugin:`, `plugin-data:`, `plugin-temp:`)
- https://developer.adobe.com/premiere-pro/uxp/plugins/hybrid-plugins/build (File System Access — relaxed for hybrid)

**Assumptions**
- Spec §21 "presets stored in pluginDataFolder" is correct and endorsed. The only correction needed: also document the uninstall-wipes-data caveat and provide an export/backup path.

---

## 5. Clean-room / distribution branding constraints

**Confirmed facts**

- **Independent (self) distribution requires no Adobe review/approval** — you may host the `.ccx` on your own site/GitHub/third-party store. (Creative Cloud Marketplace is the only path that requires Adobe review.)
- **Branding / "not affiliated" constraints (for self-distributed plugins):**
  - Plugin **icons may NOT contain Adobe product assets or icons**.
  - Avoid publisher/domain/email names **confusingly similar** to Adobe brand, product, or service names.
  - Using Adobe assets/logos in the plugin or its marketing **requires explicit Adobe permission**; unapproved use will be rejected (Marketplace) and is a trademark risk for independent distribution.
  - Do **not** imply endorsement, exclusivity, or a special relationship ("#1 Adobe partner", "best in class", "exclusive", "strategic") without Adobe agreement.
  - The "Designed for…" badge requires marketplace approval and may **not** be used in the plugin UI; it must be secondary to your own brand.
  - You are **not** authorized to use the Adobe corporate logo.
  - The brand-guide principle: developer branding must be distinct from Adobe's look-and-feel; Adobe association must not be overstated.
- **Practical clean-room rule for StateMotion:** Name the plugin with its own distinct identity (no "Adobe", "Premiere", or product-icon usage in icon/branding). Marketing may state compatibility ("works with Adobe Premiere Pro") using correct product-name attribution, but must not imply Adobe affiliation, endorsement, or authorship. Do not use Adobe logos/icons in the UI or packaging.

**Sources**
- https://developer.adobe.com/developer-distribution/creative-cloud/docs/guides/branding-guidelines
- https://developer.adobe.com/developer-distribution/creative-cloud/docs/guides/submission/what-review (Adobe Branding section)
- https://developer.adobe.com/developer-distribution/experience-cloud/docs/guides/branding-guidelines
- https://www.adobevideopartner.com/.../Adobe_Video_Partner_brand_guidelines_030723.pdf ("Designed for" badge rules)
- https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/overview (independent distribution = no review)

---

## Summary of confirmed facts vs spec §21 / §11

| Claim | Status |
| --- | --- |
| Native effect loaded from MediaCore (Win `Program Files\Adobe\Common\Plugins\7.0\MediaCore`, macOS `/Library/Application Support/Adobe/Common/Plugins/7.0/MediaCore`) | ✅ Confirmed (system-level) |
| UXP panel installed via `.ccx` (UDT dev mode for testing; packaged `.ccx` for distribution) | ✅ Confirmed (note: not `.uxpaddon` — that's the native binary) |
| macOS codesign + notarize + Hardened Runtime for native binaries | ✅ Confirmed (distribution; not required for UDT dev load) |
| Windows Authenticode mandatory for native DLL | ⚠️ Not mandated by Adobe UXP docs; best-practice/recommended — OPEN ITEM |
| User presets in `pluginDataFolder` survive upgrades | ✅ Confirmed; add uninstall-wipe caveat + backup path |
| Independent distribution, no implied Adobe affiliation | ✅ Confirmed; branding constraints documented |

---

## Recommendations

1. **Spec §21/§11:** Rename "`.uxpaddon` installer" → "`.ccx` installer"; `.uxpaddon` is the native binary inside the bundle. Clarify the combined plugin is a **UXP hybrid** whose native component is a `.uxpaddon` delivered inside the `.ccx`, not a separate MediaCore `.prm` (unless a true MediaCore effect is also shipped — confirm in spec).
2. **Install paths:** Document MediaCore system-level paths for any true native effect; document `.ccx` install via Creative Cloud Desktop / UPIA for the panel.
3. **Signing:** Require macOS Developer ID sign + notarize + Hardened Runtime for distribution. For Windows, recommend (do not yet mandate) Authenticode; verify with Adobe/legal whether strict compliance is required. Dev testing via UDT does not need signing.
4. **Presets:** Use `plugin-data:` / `getDataFolder()`; document uninstall-wipe behavior and provide an export/import backup feature.
5. **Branding:** Keep distinct name/icon; allow "compatible with Adobe Premiere Pro" attribution; forbid Adobe logos/icons and affiliation claims. Add a short "not affiliated with or endorsed by Adobe" note to docs/site.

## Impact on spec

- §21 packaging claims are **largely accurate** but need terminology fixes (`.ccx` vs `.uxpaddon`, hybrid model).
- §11 installer: should describe UDT dev install + `.ccx` distribution via CC Desktop/UPIA, admin-credential prompt for hybrid.
- Add a new sub-section on clean-room branding + "not affiliated" disclaimer.
- Open item: Windows Authenticode mandate — decide policy before spec freeze.

## Follow-ups

- F21.1: Confirm whether StateMotion ships a true MediaCore effect (`.prm`/`.bundle`) in addition to the UXP hybrid `.uxpaddon`, or hybrid-only.
- F21.2: Verify Windows Authenticode requirement with Adobe UXP/legal; decide mandate vs recommendation.
- F21.3: Confirm exact `plugin-data:` path per OS for preset migration from any legacy CEP/settings store.
- F21.4: Decide distribution channel (Marketplace review vs independent `.ccx` self-host) — affects ID sourcing (Developer Distribution portal) and branding review.
