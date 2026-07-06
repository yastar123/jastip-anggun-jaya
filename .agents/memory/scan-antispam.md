---
name: Scan page anti-spam design
description: How duplicate scan prevention works on admin/scan.tsx — lessons from multiple failed approaches
---

## Final design (3-layer defence)

1. **`lastScannedCodeRef`** — if camera still sees the same barcode string, drop immediately (no timeout).
   Reset only when: camera stops, different code detected, or lookup fails.

2. **`isScanProcessingRef`** — boolean async lock; set synchronously before first `await` in `handleScanSuccess`,
   released in `finally`. Prevents concurrent callback invocations from entering `lookupAndAdd`.

3. **`addedIdsRef` (Set<number>)** — the critical third layer. Claims the package ID *synchronously*
   (no await before `addedIdsRef.current.add(pkg.id)`) after the network fetch resolves but before `setItems`.
   Even if two concurrent `lookupAndAdd` calls somehow bypass layers 1 & 2, only the first
   to reach `addedIdsRef.current.add` wins; the second sees the ID already claimed.

**Why layer 3 is necessary:** `itemsRef` is synced via `useEffect` (after render), so there is a window
where `itemsRef.current` does not yet reflect the newly added item. `addedIdsRef` fills that gap because
it is updated synchronously — no async boundary between the fetch result and the Set.add call.

**Why:** Original code used a 1.5 s setTimeout reset which fired while the camera still pointed at the
same barcode → repeated scans. Replaced with code-based lock. Then found itemsRef stale window bug →
added addedIdsRef as the definitive duplicate gate.

## Lifecycle of addedIdsRef
- `removeItem(id)` → `addedIdsRef.current.delete(id)` (allows re-scanning a removed item)
- `resetAll()` → `addedIdsRef.current.clear()`

## handleScanSuccess deps
`useCallback(fn, [])` is intentional. All access is via refs or stable React setters.
`lookupAndAdd` captured at mount is safe because it only uses refs + stable setters — no stale closure.

## VPS deployment
User runs their own VPS. Every fix here must be manually redeployed by the user to take effect in production.
