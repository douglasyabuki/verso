---
name: nextjs-oauth-persistence
description: Implement or review OAuth, server sessions, protected data access, and database persistence in a Next.js app. Use for auth integration and user-owned CRUD; choose the data model from the destination product's requirements.
---

# Next.js OAuth and persistence

Inspect the destination's manifest, lockfile, installed Next.js guides, auth library, schema, environment loading, and deployment runtime. Read the relevant local Next.js authentication, environment-variable, route-handler, and data-mutation guides before writing framework code. If Cache Components are enabled, read their authentication guidance too.

## OAuth and sessions

- Prefer the selected auth library's supported OAuth/session integration over handwritten protocol flows. Better Auth was used in the source; preserve another library when already chosen. Verify the exact adapter/import/schema APIs for the installed release.
- Keep server configuration, secrets, and database clients in server-only modules. Expose only minimal session/profile data to clients. Avoid eagerly requiring live database/OAuth connections during module evaluation if the build does not need them.
- Configure a new provider application for the new product. Match the auth origin and exact callback URLs across local, preview, and production environments. Validate return destinations so sign-in cannot become an open redirect. Handle provider cancellation, callback failure, and expired sessions visibly.
- Retain the library's state/PKCE, cookie, and CSRF protections. Verify the server session at every protected data boundary; hiding a page or checking client state does not authorize a Route Handler or Server Action. Apply the selected framework/library's origin and mutation protections to custom endpoints as well.
- Decide account linking explicitly. Do not link accounts merely because an arbitrary profile email matches; use the library's verified-identity rules and the product's intended policy. Explicit linking must verify the current signed-in user. Prevent unlinking the last usable sign-in method if unlinking is supported.
- Do not add guest accounts, password auth, provider token storage beyond library requirements, account deletion, or automatic linking just because the source app had related features. Build the requested account lifecycle.

## Durable, owned data

- Derive ownership/tenant context from the verified server session. Scope reads and writes to that context in the database query. Treat request resource IDs and claimed user IDs as untrusted. Validate mutation payloads server-side and return only required fields.
- Choose normalized entities, relational constraints, snapshots, and transaction boundaries from the new product's access patterns. The source's workspace snapshot and offline journals are product decisions, not a persistence template.
- Use atomic operations/transactions when partial success would violate the contract. Specify concurrency and retry behavior for operations where duplicate or lost writes matter. Avoid a global read-then-write pattern that can overwrite another user's or device's edits.
- Reuse an appropriately scoped database client/pool compatible with development reloads and deployment limits. For Prisma setup, load the neighboring `prisma-orm-setup` skill before copying version-specific generator/adapter examples. Keep generated code out of manual edits.
- Display loading, save failure, and retry outcomes honestly. Clear or invalidate account-scoped client data when switching users. If async work can survive sign-out, prevent a late response or queued write from entering the new session's state.
- Keep schema generation separate from migrations and release deployment. Validate an actual read/write/reload cycle on an isolated database; a successful build or in-memory mock does not prove persistence.

## Relevant verification

Select tests for implemented contracts: unauthenticated access, cross-user access, valid/invalid input, persistence after reload, expired sessions, sign-out/account switches, and transactional failure/concurrency where applicable. Unit mocks verify adapter/client behavior; separate database integration tests prove database constraints and ownership. Mocked OAuth exchange does not prove live provider consent/callback registration. Report external credentials or manual provider checks still needed.
