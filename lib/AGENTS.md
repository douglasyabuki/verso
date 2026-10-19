# Library functions

- Leave a blank line after imports and between declarations.
- Give library functions one JSDoc block immediately above the declaration: purpose, each `@param`, useful `@returns`, and an `@example`.
- Describe returned shapes and meaningful alternatives such as `null`, unchanged input, or thrown errors. State what primitive values represent. Keep TypeScript types in signatures rather than duplicating type definitions in comments.
- Keep pure domain code independent of React and persistence. Mark server-only modules explicitly and keep their imports out of client code.
