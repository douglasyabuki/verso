# Workspace coordination contexts

- Own React workflow coordination and expose it to connected presentation components. Keep the persistent document, commands, subscriptions, and storage lifecycle in `stores/workspace/`; never copy store snapshots into context state.
- Mount workflow, output, and backup providers once after readiness, in that order, without destination-dependent keys or preview-dependent mounting. Providers render providers and children; product UI belongs in `components/`.
- Navigation remains the sole owner of destinations, review contexts, career editor contexts, and return destinations. Editor review hooks derive context and coordinate updates through navigation; they do not introduce another review state owner.
- Keep one compiler in the output provider and one backup hook in the backup provider. All menu and inline backup presentations consume the same backup owner. Mount its import input exactly once in the persistent workspace composition.
- Keep compiler progress out of the workflow context. Preserve the narrow workflow-links context for wording controls. Consumer hooks throw a clear error when a required provider is missing.
- Keep interaction hooks in `hooks/`, reusable presentation in `components/`, and pure domain rules in `lib/`. Keep context-private types local; do not introduce barrels or compatibility re-exports.
- Document exported APIs and custom hooks with purpose, parameters where applicable, return behavior, and a useful example. Follow the formatter and import sorter.
