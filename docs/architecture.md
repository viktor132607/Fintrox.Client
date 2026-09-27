# Frontend boundaries

The frontend is Next.js App Router written in TypeScript. Application source uses only
`.ts`/`.tsx`; JavaScript/JSX source is not permitted under `apps/web/src`. TypeScript
runs in strict mode with `allowJs: false`. Repository architecture tooling is TypeScript too.

The frontend consumes the Web API; it never connects to PostgreSQL and never owns
accounting rules. Backend remains authoritative for rounding, posting, tax, tenancy
and permissions. Read models may be formatted for display without duplicating rules.

Every module has `api/`, `components/`, `hooks/`, `schemas/`, `types/` and one public
`index.ts`. Routes and composition can import public module entry points. A module may
import shared code; it must not import another module or the routing/composition layer.
Cross-module UI is composed in `src/composition`. Shared code must not depend on modules.

The TypeScript AST architecture checker validates static and literal dynamic imports,
re-exports and require calls; computed import paths are rejected in application source.
It also rejects JavaScript/JSX files in the active application source tree.

Module `api/` adapters will consume generated OpenAPI clients from
`shared/api/generated`. Keep a single logical API base URL; a future gateway can route
to extracted services without changing feature imports. DTOs must not expose EF entities
or private domain types. No database/ORM dependencies, embedded business backend, Redux
store or fake API is added.

Authentication and protected layouts are deferred. Route groups are organizational only,
not security boundaries. Never store secrets in `NEXT_PUBLIC` variables; do not introduce
browser-token storage or trust tenant selectors as authorization by default.

`architecture/modules.json` matches the Server catalog. Changes to ownership require a
coordinated update to both repositories. CI checks module coverage, import directions,
TypeScript tooling and application type safety.
