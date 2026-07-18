### Task 2: Convert values inside UxpHostBridge read/write

**Files:**
- Modify: `src/statemotion/panel/src/host/uxpHost.ts:73-90` (readLogical/writeLogical)
- Test: `src/statemotion/panel/src/host/uxpHost.test.ts`

**Interfaces:**
- Consumes: `toNative`, `toCanonical` from `./valueConversion.ts`; `getBinding` from generated bindings; existing `findEffect`, `enumerateParamIndex`, `resolveClip` helpers in same file.
- Produces: `UxpHostBridge` whose `readLogical`/`writeLogical` now perform conversion; interface signatures in `HostBridge` (`readLogical`, `writeLogical`) unchanged.

The host `setValue`/`getValue` work with native shapes. POINT native shape is unknown/unverified — keep marshal in this module only. For write: `const native = toNative(logicalId, value, binding); prop.setValue(marshal(native));`. For read: `const native = unmarshal(raw); return toCanonical(logicalId, native, binding);`.

- [ ] **Step 1: Write/extend failing test in uxpHost.test.ts**

```ts
// add to uxpHost.test.ts
import { UxpHostBridge } from './uxpHost';
import { getBinding } from '../../../../../shared/generated/parameterBindings.ts';

test('writeLogical converts canonical -> native before setValue', async () => {
  const written: Record<string, unknown> = {};
  const bridge = new UxpHostBridge();
  // minimal fake app with one StateMotion effect exposing a setValue that records native value
  (globalThis as any).app = {
    project: { activeSequence: { videoTracks: [{ clips: [{ nodeId: 'c1', components: [{ matchName: 'AE.io.github.anmol2k5.statemotion.effect', properties: { numProperties: 1, getProperty: (i: number) => ({ displayName: 'SM Manual Progress', setValue: (v: unknown) => { written['transition.manualProgress'] = v; } }) } }] }] } } },
  };
  await bridge.writeLogical({ clipId: 'c1' }, 'transition.manualProgress', 0.5);
  expect(written['transition.manualProgress']).toBe(50); // native percent, not 0.5
});

test('readLogical converts native -> canonical', async () => {
  const bridge = new UxpHostBridge();
  (globalThis as any).app = {
    project: { activeSequence: { videoTracks: [{ clips: [{ nodeId: 'c1', components: [{ matchName: 'AE.io.github.anmol2k5.statemotion.effect', properties: { numProperties: 1, getProperty: (i: number) => ({ displayName: 'SM Manual Progress', getValue: () => 50 }) } }] }] } } },
  };
  const v = await bridge.readLogical({ clipId: 'c1' }, 'transition.manualProgress');
  expect(v).toBe(0.5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: panel test command on `uxpHost.test.ts`
Expected: FAIL (writeLogical still writes 0.5 raw; readLogical returns undefined).

- [ ] **Step 3: Implement conversion in uxpHost.ts**

Replace `readLogical`/`writeLogical` (lines 73-90) with:

```ts
  // Marshal a StateMotion native value into the host-specific shape. POINT object
  // shape is host-specific and UNVERIFIED; keep this tiny transform here only.
  private marshalNative(_logicalId: string, native: number | string | { x: number; y: number }): unknown {
    return native; // identity until Premiere POINT shape is operator-verified
  }
  private unmarshalNative(_logicalId: string, raw: unknown): number | string | { x: number; y: number } {
    return raw as number | string | { x: number; y: number };
  }

  async readLogical(clip: ClipRef, logicalId: string): Promise<number | string | undefined> {
    const binding = getBinding(logicalId);
    if (!binding) return undefined;
    const effect = await this.findEffect(clip);
    if (!effect) return undefined;
    const wireName = logicalIdToWireName(logicalId);
    const index = wireName ? await this.enumerateParamIndex(clip, wireName) : undefined;
    if (index === undefined) return undefined;
    const prop = effect.properties?.getProperty?.(index);
    if (!prop || typeof prop.getValue !== 'function') return undefined;
    const native = this.unmarshalNative(logicalId, prop.getValue());
    return toCanonical(logicalId, native as any, binding);
  }

  async writeLogical(clip: ClipRef, logicalId: string, value: number | string): Promise<void> {
    const binding = getBinding(logicalId);
    if (!binding) throw new Error(`Unknown logical ID ${logicalId}`);
    const effect = await this.findEffect(clip);
    if (!effect) throw new Error('StateMotion effect not found on clip');
    const wireName = logicalIdToWireName(logicalId);
    const index = wireName ? await this.enumerateParamIndex(clip, wireName) : undefined;
    if (index === undefined) throw new Error(`Cannot resolve parameter ${logicalId} on clip`);
    const prop = effect.properties?.getProperty?.(index);
    if (!prop || typeof prop.setValue !== 'function') {
      throw new Error(`UXP setValue unavailable for ${logicalId} (unverified host API)`);
    }
    const native = toNative(logicalId, value, binding);
    prop.setValue(this.marshalNative(logicalId, native));
  }
```

Add import at top of `uxpHost.ts`:
```ts
import { toNative, toCanonical } from './valueConversion';
```

- [ ] **Step 4: Run test to verify it passes**

Run: panel test command
Expected: PASS (new tests + existing uxpHost tests).

- [ ] **Step 5: Commit**

```bash
git add src/statemotion/panel/src/host/uxpHost.ts src/statemotion/panel/src/host/uxpHost.test.ts
git commit -m "fix(panel): convert canonical<->native in UxpHostBridge read/write"
```

---

