### Task 3: PremiereAdapter.readState + create-from-instance

**Files:**
- Modify: `src/statemotion/panel/src/host/premiereAdapter.ts` (add `readState`, typed errors)
- Test: `src/statemotion/panel/src/host/premiereAdapter.test.ts`
- Modify: `src/statemotion/panel/src/ui/inspector.ts` (wire "Create preset from selection")
- Possibly modify: `src/statemotion/panel/src/domain/presetStorage.ts` only if a `buildPresetFromConfig` helper is needed (otherwise build inline in adapter or a small `starter`/`domain` factory).

**Interfaces:**
- Produces:
  - `class ContractIncompatible extends Error`
  - `class ContractReadOnly extends Error`
  - `interface CanonicalStateMotionConfig { parameters: Record<string, number | string>; }`
  - `PremiereAdapter.readState(clip: ClipRef): Promise<CanonicalStateMotionConfig>`
- Consumes: existing `checkCompatibility`, `CompaLevel` from `../domain/compatibility.ts`; `getBinding` (for `stateOwnership !== 'metadata'` filter) from generated bindings; `HostBridge.getContract`, `readLogical`; existing `PresetRepository.create` (already exists, validates + writes).

`readState` flow (spec §8): locate valid instance → validate contract (throw if Incompatible/ReadOnly) → build `EffectParameterMap` → for each creative logical ID (`stateOwnership !== 'metadata'`) call `host.readLogical(clip, id)` → collect canonical → return `{ parameters }` (metadata excluded).

- [ ] **Step 1: Write failing test**

```ts
// in premiereAdapter.test.ts
test('readState returns canonical creative config, excludes metadata', async () => {
  const adapter = new PremiereAdapter(fakeBridgeWithState({
    'transition.manualProgress': 50,      // native -> canonical 0.5
    'transform.scaleX.b': 130,           // native -> canonical 1.3
    'transform.opacity.b': 100,          // native -> canonical 1
    'contract.schemaVersion': 1,
    'contract.parameterCount': 20,
    'contract.bindingRevision': 1,
  }));
  const cfg = await adapter.readState({ clipId: 'c1' });
  expect(cfg.parameters['transition.manualProgress']).toBe(0.5);
  expect(cfg.parameters['transform.scaleX.b']).toBeCloseTo(1.3);
  expect(cfg.parameters['transform.opacity.b']).toBe(1);
  expect(cfg.parameters['contract.schemaVersion']).toBeUndefined();
});

test('readState throws on incompatible contract', async () => {
  const adapter = new PremiereAdapter(fakeBridgeWithContract({ schemaVersion: 2, bindingRevision: 1, parameterCount: 20 }));
  await expect(adapter.readState({ clipId: 'c1' })).rejects.toThrow();
});
```

(`fakeBridgeWithState` is a test double: `getContract` returns the 3 metadata native values mapped to a contract; `readLogical` converts native→canonical via the real `toCanonical`; `enumerateParamIndex` returns a stable index by wireName. Add a `fakeBridgeWithContract` helper for the incompatible case.)

- [ ] **Step 2: Run test to verify it fails**

Run: panel test command
Expected: FAIL (readState not defined).

- [ ] **Step 3: Implement readState in premiereAdapter.ts**

Add to `premiereAdapter.ts` (after `applyPresetToSelection`):

```ts
export class ContractIncompatible extends Error {
  constructor(public reasons: string[]) { super('Contract incompatible: ' + reasons.join('; ')); }
}
export class ContractReadOnly extends Error {
  constructor(public reasons: string[]) { super('Contract read-only: ' + reasons.join('; ')); }
}

export interface CanonicalStateMotionConfig {
  parameters: Record<string, number | string>;
}

// Pure filter: creative params only (exclude hidden metadata ownership).
function isCreative(logicalId: string): boolean {
  const b = getBinding(logicalId);
  return !!b && b.stateOwnership !== 'metadata';
}

async readState(clip: ClipRef): Promise<CanonicalStateMotionConfig> {
  const contract = await this.host.getContract(clip);
  const compat = checkCompatibility(contract);
  if (compat.level === CompatLevel.Incompatible) throw new ContractIncompatible(compat.reasons);
  if (compat.level === CompatLevel.ReadOnly) throw new ContractReadOnly(compat.reasons);
  if (!(await this.host.hasStateMotionEffect(clip))) throw new Error('No StateMotion effect on clip');

  const params: Record<string, number | string> = {};
  for (const id of LOGICAL_IDS) {
    if (!isCreative(id)) continue;            // never read metadata
    const v = await this.host.readLogical(clip, id);
    if (v === undefined) continue;
    params[id] = v;
  }
  return { parameters: params };
}
```

Add imports: `import { getBinding, LOGICAL_IDS } from '../../../../../shared/generated/parameterBindings.ts';` (merge with existing compat import line).

- [ ] **Step 4: Run test to verify it passes**

Run: panel test command
Expected: PASS.

- [ ] **Step 5: Wire create-from-instance in inspector.ts**

Add a `getContract(clip: ClipRef)` passthrough method on `PremiereAdapter` that calls `this.host.getContract(clip)` (so the inspector can read `compatibleContract` without touching the host directly). Add `setRepository(repo: PresetRepository)` to `InspectorView`. In `render`, after the supported-summary block, add a "Create preset from selection" button:

```ts
const createBtn = el('button', { class: 'sm-btn', text: 'Create preset from selection' }) as HTMLButtonElement;
createBtn.addEventListener('click', async () => {
  try {
    const clip = supported[0];
    const cfg = await this.adapter.readState(clip);
    const contract = await this.adapter.getContract(clip);
    const preset = buildUserPresetFromConfig(cfg, contract);
    await this.repository.create(preset);
    showState(container, '✅', 'Preset created', `Saved "${preset.name}" from ${clip.clipId}.`);
  } catch (e) {
    showState(container, '⚠️', 'Create failed', String((e as Error).message));
  }
});
```

`buildUserPresetFromConfig(cfg: CanonicalStateMotionConfig, contract: CompatibleContract | null): StateMotionPreset` is a small pure helper (add to `src/domain/presetSchema.ts`). It assembles a valid preset: `formatId`, `schemaVersion: CURRENT_SCHEMA_VERSION`, generated `presetId` (`'user-' + Date.now().toString(36)`), name `StateMotion <clipId>`, empty description/author `'StateMotion'`, ISO timestamps, empty tags, category `'Custom'`, empty collections, `compatibleContract` from the passed contract (fallback to current generated `{schemaVersion, bindingRevision, parameterCount}`), `parameters: cfg.parameters`, `preview: { kind: 'generated' }`. Assert `validatePreset(preset).ok` in its own test.

- [ ] **Step 6: Run full panel test suite**

Run: panel test command (all)
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/statemotion/panel/src/host/premiereAdapter.ts src/statemotion/panel/src/host/premiereAdapter.test.ts src/statemotion/panel/src/ui/inspector.ts
git commit -m "feat(panel): add PremiereAdapter.readState + create-from-instance"
```

---

