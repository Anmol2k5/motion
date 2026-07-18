// StateMotion Preset Panel — apply plan (pure planner; no host calls).
//
// Given a selection of clips and a preset's contract, classify each clip and
// produce an ordered change set. No parameter writes happen here; the adapter
// executes the plan inside one undo transaction. Unknown/newer contracts are
// never written to.

import { checkCompatibility, CompatLevel } from './compatibility.ts';
import type { CompatibleContract } from './presetSchema.ts';

export enum ItemStatus {
  Supported = 'supported',
  Unsupported = 'unsupported',
  Incompatible = 'incompatible',
}

export interface SelectionItem {
  clipId: string;
  hasStateMotion: boolean;
  contract: CompatibleContract | null;
}

export interface PlanItem {
  clipId: string;
  status: ItemStatus;
  reason: string;
}

export interface ApplyPlan {
  presetId: string;
  items: PlanItem[];
  summary: { applied: number; skipped: number; failed: number };
}

export function buildApplyPlan(
  selection: SelectionItem[],
  presetId: string,
  presetContract: CompatibleContract,
): ApplyPlan {
  const items: PlanItem[] = [];
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  // The preset itself declares a contract; only matching/older current is safe.
  const presetCompat = checkCompatibility(presetContract);
  if (presetCompat.level === CompatLevel.Incompatible) {
    // Entire preset is unwriteable on this build.
    for (const s of selection) {
      items.push({ clipId: s.clipId, status: ItemStatus.Incompatible, reason: 'preset contract incompatible with this build' });
      failed++;
    }
    return { presetId, items, summary: { applied, skipped, failed } };
  }

  for (const s of selection) {
    if (!s.hasStateMotion) {
      items.push({ clipId: s.clipId, status: ItemStatus.Unsupported, reason: 'no StateMotion effect on clip' });
      skipped++;
      continue;
    }
    const clipCompat = checkCompatibility(s.contract);
    if (clipCompat.level === CompatLevel.Incompatible) {
      items.push({ clipId: s.clipId, status: ItemStatus.Incompatible, reason: clipCompat.reasons.join('; ') });
      failed++;
      continue;
    }
    if (clipCompat.level === CompatLevel.ReadOnly) {
      items.push({ clipId: s.clipId, status: ItemStatus.Incompatible, reason: 'effect contract older than preset; read-only diagnostic' });
      failed++;
      continue;
    }
    items.push({ clipId: s.clipId, status: ItemStatus.Supported, reason: 'ok' });
    applied++;
  }

  return { presetId, items, summary: { applied, skipped, failed } };
}
