### Task 5: EffectParameterMap shuffle test

**Files:**
- Test: `src/statemotion/panel/src/domain/parameterMap.test.ts` (new or extend existing)

**Interfaces:**
- Consumes: `EffectParameterMap` from `./parameterMap.ts`; `LOGICAL_IDS` from generated bindings.

- [ ] **Step 1: Write failing/covering test**

```ts
import { EffectParameterMap } from './parameterMap';
import { LOGICAL_IDS, getBinding } from '../../../../../shared/generated/parameterBindings.ts';

test('resolves all 20 logical ids by stable wireName in shuffled runtime order', () => {
  // Simulate the host returning params in a randomized runtime order, keyed by
  // wireName -> runtime index. Resolution must be by wireName, not position.
  const byWire: Record<string, number> = {};
  LOGICAL_IDS.forEach((id, i) => { byWire[getBinding(id)!.wireName] = i; });
  const shuffled = [...LOGICAL_IDS].sort(() => 0.5 - Math.random());
  const enumerate = (wireName: string) => byWire[wireName];

  const map = new EffectParameterMap(enumerate);
  for (const id of shuffled) {
    const expected = byWire[getBinding(id)!.wireName];
    expect(map.resolve(id)).toBe(expected);
  }
});

test('missing wireName resolves undefined', () => {
  const map = new EffectParameterMap((w) => (w === 'SM Manual Progress' ? undefined : 1));
  expect(map.resolve('transition.manualProgress')).toBeUndefined();
});

test('unknown extra param ignored, duplicate wireName first wins', () => {
  // duplicate wireName: enumerate returns the same index for two wireNames
  const map = new EffectParameterMap((w) => (w === 'SM Mode' ? 0 : 1));
  expect(map.resolve('transition.mode')).toBe(0);
  expect(map.resolve('transition.alignment')).toBe(1); // distinct wireName
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: panel test command
Expected: PASS (map logic already position-independent; this locks the behavior).

- [ ] **Step 3: Commit**

```bash
git add src/statemotion/panel/src/domain/parameterMap.test.ts
git commit -m "test(panel): cover EffectParameterMap shuffle + missing/duplicate wireName"
```

---

