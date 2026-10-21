# Shared types and constants

- Group files by domain: `resume.ts` defines editable-document contracts and defaults, `workspace.ts` defines observable state and persistence outcomes, and `editor.ts` defines shared editing contracts. Add a domain file only when it has a real consumer.
- Include types consumed across modules and stable declarative values such as supported locales, section kinds, and shared defaults. Use named exports directly; do not add broad barrel modules.
- Derive validated data types from the canonical Zod schemas in `lib/resume/model.ts`. Use indexed access for nested document types rather than duplicating handwritten shapes. Schema dependencies must use `import type` so that constants can be consumed by schemas without a runtime cycle.
- Keep component-specific props, hook options, and implementation-private types beside their implementations. Hook option types follow `<HookWithoutUse>Options`. External-library declaration augmentations belong in `types/`.
- Runtime dependencies must not import stores, hooks, components, browser APIs, or modules with side effects. Keep functions, mutable application state, persistence, React contexts, and icon-bearing UI configuration outside this directory.
- Preserve literal inference for supported-value lists with `as const`. Give shared defaults explicit domain types; consumers must copy defaults before changing them.
- Leave a blank line after imports and between declarations. Follow the repository formatter and import sorting rules.
