# Clean-Room Notes — StateMotion

This document records the clean-room constraints and the public behavioral sources
used to inspire StateMotion. It is the canonical record required by the project
brief and the build spec (§2).

## Status

StateMotion is an **independent, clean-room implementation** inspired by the
general idea of state-based (A/B) clip animation without manually created
keyframes. It is not affiliated with, endorsed by, or derived from any commercial
product.

## Permitted behavioral references (general workflow only)

These describe *general behavior* that may be recreated from scratch:

- Two visual states, A and B, per animatable property.
- Automatic interpolation derived from clip/sequence time, with no user-created
  keyframes in automatic modes.
- Start-, end-, and full-clip transition alignment.
- Easing, overshoot/anticipation, spring, and bounce curve families.
- Property families: transform, crop, rounded corners, stroke, glow, shadow,
  motion blur.
- A preset browser and management panel.

Public behavioral reference page (read only for behavior, not implementation):

- `https://www.jakeinmotion.com/motion-state` — used solely to understand the
  general workflow. No source, binary, asset, preset, or copy was inspected or
  extracted.

## Forbidden

Do **not** do any of the following:

- Reverse engineer, decompile, or inspect any commercial plugin binary.
- Copy source code, preset files, package contents, website source, preview
  assets, icons, branding, product copy, or proprietary parameter/internal names.
- Recreate the exact preset collection, preset names, default values, interface
  layout, or visual identity of any commercial product.
- Claim compatibility, affiliation, or endorsement with any commercial product or
  with Adobe beyond what a self-distributed plugin legitimately requires.

## Internal naming (original, PERMANENT)

These identifiers are fixed and must not change once distributed (existing Premiere
projects rely on the effect match name).

- Product display name: **StateMotion**.
- Native effect match name: `AE.io.github.anmol2k5.statemotion.effect`
- Preset format identifier: `io.github.anmol2k5.statemotion.preset`
- UXP plugin ID (independent distribution): `io.github.anmol2k5.statemotion.panel`
- Internal namespace: `io.github.anmol2k5.statemotion`
- Internal model names: `StateA`, `StateB`, `ProgressMode`, `CurveModel`.

Rationale: GitHub-backed namespace (`anmol2k5`) is defensible and original; separate
`.effect` / `.panel` / `.preset` suffixes avoid collisions. A future domain-owned
commercial namespace is a separate compatibility decision, not a silent rename.

## Permitted vs forbidden reference material

**Permitted (general workflow + concept only):**
- A/B state animation; automatic interpolation without manually created keyframes.
- Clip-start / clip-end / full-duration timing concepts.
- Easing families: cubic-bezier, anticipation, overshoot, spring, bounce.
- Property families: transform, crop, rounded corners, stroke, shadow, glow, motion blur.
- Preset browser / editable states / favorites / collections / batch-apply concept.
- Public Adobe documentation and SDK samples; independent experiments and prototypes.
- The public product page ONLY to record broad observable capabilities — never as a
  frame-by-frame visual or timing target.

**Forbidden:**
- Inspect, decompile, disassemble, or extract the commercial plugin binary.
- Copy private source, package internals, preset files, config, or undocumented data.
- Copy exact preset names, groupings, descriptions, defaults, numeric values, ordering.
- Reproduce exact UI layout, icons, thumbnails, preview footage, typography, branding,
  product copy, or visual identity.
- Tune StateMotion frame-by-frame against the commercial demo.
- Copy unusual parameter combinations solely because they appear in a commercial preset.
- Use the "Motion State" name or imply compatibility, affiliation, endorsement, or
  replacement.

Every implementation choice must be independently justified via Adobe SDK constraints,
general animation/graphics principles, StateMotion's own requirements, original
prototypes/tests, and original preset design.

## Presentation and non-affiliation

- Permitted referential wording: "StateMotion plugin for Adobe Premiere Pro",
  "compatible with Adobe Premiere Pro 26.3 and later", "Requires Adobe Premiere Pro".
  Adobe's name identifies the host only.
- Forbidden: Adobe/Premiere inside the product name; "Adobe StateMotion" /
  "Premiere StateMotion"; Adobe marks in company/domain/plugin-ID/package/social/logo;
  Adobe logos/icons/imagery without authorization; "official / approved / certified /
  endorsed / partner" language without authorization; Adobe branding more prominent
  than StateMotion; abbreviating as PR/PP in formal copy.
- Distribution: independent `.ccx` (no Adobe review required for direct distribution;
  CC Desktop shows an independent-plugin warning). Use a distribution-specific plugin
  ID; a future Marketplace listing needs a separate ID + Adobe review.

**Required disclaimer** (panel About/Diagnostics, README, docs site, download page,
and this file):

> StateMotion is an independent third-party plugin for Adobe Premiere Pro. It is not
> authorized, endorsed, sponsored by, or affiliated with Adobe Inc. Adobe and Premiere
> Pro are either registered trademarks or trademarks of Adobe in the United States
> and/or other countries.
>
> StateMotion is an independently developed product and is not affiliated with,
> endorsed by, or derived from Motion State or its creator.

## Preset creation rule

All presets (built-in and user) are created from scratch with original names,
descriptions, default values, and thumbnails. No commercial preset is reproduced.

## Evidence rule

Every Adobe API name, version requirement, effect-host limitation, GPU claim,
installation path, and packaging assumption must be verified against current
primary Adobe documentation before implementation. See the research tickets under
`.scratch/statemotion-wayfinder/issues/` and artifacts in `docs/research/`.

## Preset Panel — broad capability observations (2026-07-18)

StateMotion Preset Panel is an original UXP panel. Broad user-visible capabilities
inspired generally (NOT copied) from commercial motion-preset tools, with independent
StateMotion design decisions:

| Observed broad capability (general) | Independent StateMotion decision | No proprietary asset/internal used |
|---|---|---|
| Searchable preset library | Original Library view with substring search over name/tags/description/category | Yes — original UI |
| Categories / collections | Original categories (Entrances, Exits, Slides, Zooms, Focus, Layout, Screen, Titles, Custom) + user collections | Yes — original names |
| Favorites | `favoritePresetIds` in local `library.json`, no file mutation of bundled/user presets | Yes |
| User presets + create/edit/delete/duplicate | Original user-preset repository under UXP plugin data folder | Yes |
| Thumbnails / previews | Deterministic SVG/CSS preview cards generated from preset values (no video decode) | Yes — generated, no asset |
| Preset management view | Original Manage view (import/export/collections/compatibility) | Yes |
| Separate panel alongside Effect Controls | Original three-view panel (Library / Inspector / Manage) | Yes — original layout |
| Import / export portability | `.stmpreset` files, validated + migrated, never executed | Yes |

No commercial preset name, value, layout, color, icon, thumbnail, or asset was
reproduced. All starter-preset names/values are independently chosen.
