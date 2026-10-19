# Custom hooks

- Name options types `<HookWithoutUse>Options`, for example `useSearch(options: SearchOptions)`.
- Keep generic hooks at the hooks root and feature-specific hooks in matching subfolders.
- Give each hook one JSDoc block describing purpose, every parameter, the returned values and meaningful alternatives, and a useful usage example. Keep TypeScript types in signatures.
- Leave a blank line after imports and between declarations.
