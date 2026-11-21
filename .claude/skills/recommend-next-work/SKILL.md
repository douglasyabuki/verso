---
name: recommend-next-work
description: "Recommend exactly one next Verso work item in a read-only decision report. Use only when explicitly invoked by name as $recommend-next-work or /recommend-next-work. Do not activate automatically for planning, prioritization, roadmap, or what-to-do-next requests."
disable-model-invocation: true
---

# Recommend the next Verso work item

Inspect the current checkout and recommend exactly one work item. Keep the
invocation read-only and return the report in the conversation. Leave the checkout
and existing user data untouched. Implementation requires a separate request.

Evaluate work against Verso's core journey from a shared career record to tailored
resumes:

Maintain career information → tailor a resume → save edits → preview and resolve
PDF issues → download or publish

Use the project references below for durable rules about drafts, committed changes,
recovery, backups, PDF generation, and publication. Verify current behavior against
the checkout before relying on a documented capability or limitation.

## Inspect in order

1. **Establish what ships.** Read [AGENTS.md](../../../AGENTS.md),
   [README.md](../../../README.md), [architecture](../../../docs/architecture.md),
   and [package.json](../../../package.json). Identify active routes, state owners,
   capabilities, and relevant verification commands. Follow applicable nested
   repository instructions.
2. **Shared career record.** Trace how users find, edit, archive, and restore
   career information. Check navigation, labels, empty states, feedback, and
   actions that take more steps than users would expect.
3. **Resume tailoring.** Trace creation and duplication, content selection and
   ordering, wording overrides, and layout. Check for repetitive work, hard-to-find
   controls, and places where users can lose track of the active resume or what an
   edit affects.
4. **Save and recovery.** Read [Save and recovery](../../../docs/recovery-files.md).
   Start with [the career controller](../../../stores/career/controller.ts), then
   read its relevant callers and tests. Trace what Save and Cancel communicate
   and what changes they commit or discard. Check unsaved changes, draft recovery,
   and Undo/Redo.
5. **PDF preview and output.** Follow saved content through preview, issue
   resolution, refresh, and download. Consult
   [compiler maintenance](../../../docs/compilation-proof.md) for compiler questions
   and [accounts and public PDFs](../../../docs/accounts-and-public-pdfs.md) when
   account behavior or publication affects a candidate.
6. **Structure behind the workflows.** Look for components with loosely related
   responsibilities, repeated UI or interaction logic, domain rules in presentation,
   and file organization that obscures feature ownership. Trace actual imports
   and callers before proposing moves or extractions.
7. **Verify the strongest findings.** Read the relevant implementation and tests.
   Walk through affected flows in a browser when available within the read-only
   scope. Use disposable data for interactions that write state. Distinguish
   direct observations, inferences from code, and unverified behavior. Report
   which checks ran and which were unavailable or skipped.

## Rank candidates

1. **Verified data integrity issues or core workflow blockers.** Prioritize work
   loss, incorrect commits, and blockers in the core journey.
2. **UX/UI improvements to existing workflows.** This is the default priority.
   Look for unclear feedback, hidden actions, weak empty states, confusing
   controls, and avoidable steps in common tasks.
3. **Finish an existing capability.** Identify a task users can start today and
   the specific gap a small enhancement would close.
4. **Performance or stability.** Move this up when friction in a common workflow
   is reproducible or measurable. Name the interaction, conditions, and impact.
5. **Structural refactoring.** Consider splitting unrelated responsibilities,
   extracting cohesive UI or interaction logic, moving domain rules to the existing
   domain layer, consolidating diverged logic, or organizing files by ownership.
   Name the files, what would move or change ownership, the behavior to preserve,
   and what work it unlocks. Give little weight to file length or directory tidiness
   alone. Move a refactor up when it is a prerequisite for safely shipping
   higher-priority work.
6. **New features.** Consider a bounded feature for a meaningful user need that a
   smaller improvement to an existing workflow cannot adequately address.
7. **Standalone tests or developer tooling.** Consider a focused change for a
   demonstrated regression risk or recurring development bottleneck. Move it up
   when it is a prerequisite for safely shipping higher-priority work. Include the
   verification for any recommended change within that change's scope.

Evaluate at least four options. Always consider a UX/UI improvement, an enhancement
that finishes an existing capability, a structural refactor, and a new feature.
Include performance, stability, or standalone tests and tooling when warranted.
If a category yields no credible candidate, say what you checked and why, and
look for credible options elsewhere in the core journey to reach four.

Compare user impact, evidence strength, dependency order, regression risk, scope,
and testability. Explain any departure from the default priority order. When
options are close, choose the smallest change that improves the core workflow.

## Return the report in this order

1. **Short answer** — Name the recommended work item and explain why it comes next.
2. **What you inspected** — List the relevant file paths, tests, and user flows.
3. **Current state and main bottleneck** — Describe what works today and where the
   strongest evidence points. Distinguish verified findings from hypotheses.
4. **Options considered** — Use a compact table showing each option's user impact,
   evidence, dependencies, regression risk, scope, testability, and ranking rationale.
5. **Recommended scope and non-goals** — Define the smallest useful change. Name
   likely files or modules, relevant UI or state changes, and what falls outside
   the scope.
6. **Implementation plan** — Outline the steps for completing the work.
7. **Acceptance criteria and safeguards** — Specify observable behavior, the checks
   that would verify it, and existing behavior that needs regression coverage.
8. **Final recommendation** — End with one sentence beginning `Do this next: `.
