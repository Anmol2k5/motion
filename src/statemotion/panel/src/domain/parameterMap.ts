// StateMotion Preset Panel — EffectParameterMap (the approved seam).
//
// Raw Premiere runtime parameter indexes are VOLATILE and never leave this
// module. Resolution: logicalId -> generated binding -> stable wireName ->
// host enumerate(wireName) -> validated runtime index.
//
// The host callback must return the runtime index for a given wireName by
// inspecting the actual effect instance. If the wireName is absent (index
// drift / unknown param), resolution yields undefined and the caller must NOT
// write blindly.

import { getBinding } from '../../../../../shared/generated/parameterBindings.ts';

export type EnumerateFn = (wireName: string) => number | undefined;

export class EffectParameterMap {
  private cache = new Map<string, number | undefined>();

  constructor(private enumerate: EnumerateFn) {}

  resolve(logicalId: string): number | undefined {
    if (this.cache.has(logicalId)) return this.cache.get(logicalId);
    const binding = getBinding(logicalId);
    if (!binding) {
      this.cache.set(logicalId, undefined);
      return undefined;
    }
    const index = this.enumerate(binding.wireName);
    this.cache.set(logicalId, index);
    return index;
  }

  // Validate that the bound wireName actually exists in the instance.
  isResolvable(logicalId: string): boolean {
    return this.resolve(logicalId) !== undefined;
  }
}
