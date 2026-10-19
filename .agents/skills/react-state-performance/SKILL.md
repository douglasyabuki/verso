---
name: react-state-performance
description: Investigate React state and rendering bottlenecks and make incremental improvements to Context boundaries, derived work, or selective store subscriptions. Use for performance work; require evidence before a store migration.
---

# React state performance

Inspect the installed React/Next.js/store versions, providers, consumers, derived calculations, effects, and persistence lifetimes. Read relevant installed Next.js guides before changing framework boundaries. Preserve the app's existing contracts and state tool unless the requested work justifies a change.

- Reproduce a concrete slow interaction with representative data. Profile the affected path when possible and measure computation/storage separately. Compare repeated runs using the same data, device, build mode, and route. Development Strict Mode can distort counts; state measurement limitations plainly.
- Trace whether updates come from local state, parents, Context identity, broad subscriptions, or effects. Render frequency alone is not evidence of expensive work. Search all consumers before changing a shared contract.
- Keep drafts, popovers, and other single-owner state local. Move state nearer its consumers, split Contexts by update frequency, or stabilize identities when those changes address the measured cause. Memoizing Context values does not prevent updates when their actual contents change.
- Use a selective store only when independent subscriptions address an established shared-state problem. If Zustand is selected, inspect its installed selector/equality APIs and preserve stable selected references. Do not install or migrate to a store merely because persistence exists.
- Change one boundary/calculation at a time. Preserve one writable source of truth, structural sharing, provider lifetime, hydration, and account isolation. Avoid two competing state copies during migration.
- Re-run the same interaction and compare relevant timings. Verify observable behavior, drafts/cancel, focus, persistence, and owner changes when affected. Prefer behavioral regression checks over exact development render counts. Remove temporary instrumentation unless it is meant to be maintained.

Report measured gains separately from hypotheses. If no bottleneck is established, a scoped finding without a refactor is a valid outcome.
