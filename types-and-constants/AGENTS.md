# Shared types and constants

- Group files by cohesive responsibility, keeping related types and constants together. Add a file only for a distinct responsibility with real consumers; do not create files for individual nested document types.
- `languages.ts` owns the ordered locales, locale type, language names, and flag mappings. Keep it independent of resume contracts.
- `resume.ts` owns schema-derived document and wording contracts, localized field descriptors, document updates, and resume colors. Keep nested document types together here.
- `sections.ts` owns section kinds, entry terminology, and library section labels. `output.ts` owns template settings, defaults and labels, compilation results, and output layout contracts.
- `review.ts` owns issues, review items, categories, filters, and return context. `navigation.ts` owns destinations, tabs/pages, focus targets, issue navigation, and library editor context.
- `editor.ts` owns shared editor props and confirmation contracts. `workspace.ts` owns observable state, snapshots, persistence outcomes, and edit grouping.
- Include types consumed across modules and stable declarative values such as supported locales, section kinds, and shared defaults. Import named exports directly from their owning file; do not add compatibility re-exports or barrel modules.
- Export only types and constants consumed outside their owning file. Keep file-local helpers private and remove declarations with no consumers.
- Derive validated data types from the canonical Zod schemas in `lib/resume/model.ts`. Use indexed access for nested document types rather than duplicating handwritten shapes. Schema dependencies must use `import type` so that constants can be consumed by schemas without a runtime cycle.
- Keep component-specific props, hook options, and implementation-private types beside their implementations. Hook option types follow `<HookWithoutUse>Options`. External-library declaration augmentations belong in `types/`.
- Runtime dependencies must not import stores, hooks, components, browser APIs, or modules with side effects. Keep functions, mutable application state, persistence, React contexts, and icon-bearing UI configuration outside this directory.
- Preserve literal inference for supported-value lists with `as const`. Give shared defaults explicit domain types; consumers must copy defaults before changing them.
- Leave a blank line after imports and between declarations. Follow the repository formatter and import sorting rules.
