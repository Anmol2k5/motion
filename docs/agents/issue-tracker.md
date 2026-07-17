# Issue Tracker

Issues for the StateMotion project are tracked as local markdown files under `.scratch/`.

Reason: this repository has no GitHub remote configured and no `gh` login, so the
local-markdown tracker is the supported fallback for the engineering skills
(Wayfinder, to-tickets, triage).

## Layout

- `.scratch/statemotion-wayfinder/map.md` — the Wayfinder map (`wayfinder:map`).
- `.scratch/statemotion-wayfinder/issues/<id>-<slug>.md` — one file per ticket.
- Each ticket file front-matter carries: type, status, labels, blocks / blocked-by.

## Conventions

- The Wayfinder map is the index; tickets are the detail.
- Issue id is the filename prefix (e.g. `001-...`). It is a local handle, not a
  GitHub number.
- Refer to tickets by their title (name), never just the id.
- Research artifacts belong in `docs/research/`; tickets link to them.

## Workflow notes

- Wayfinder: one non-research decision ticket resolved per session.
- Research tickets may run in parallel as `/research` subagents.
- This is a clean-room project; no commercial Motion State material is referenced,
  copied, or stored here.
