# Fintrox.Client

Next.js App Router + TypeScript frontend for Fintrox.Server (ASP.NET Core Web API / PostgreSQL).

## Local commands

```bash
npm ci
npm run dev
npm run check
npm run build
```

Use Node 22+; dev runs at http://localhost:3000. Run commands from the repository root.
`apps/web/.env.example` reserves the API base URL. No API calls or credentials are needed
for the skeleton. Production: `npm run build` then `npm start` (supports PORT).

## Structure

- `apps/web/src/app`: thin Next.js routing/layout; reserved auth/workspace groups.
- `apps/web/src/modules`: 21 business modules aligned with the backend catalog.
- `apps/web/src/shared`: reusable presentation, config and generated API types; no financial rules.
- `apps/web/src/composition`: future cross-module UI composition.
- `architecture/modules.json`: ownership inventory matching the server.
- `tests`: future contract and end-to-end tests.

The current screen is only a neutral application shell. Business pages, API calls,
authentication, design system and feature behavior are intentionally unimplemented.
Tailwind/shadcn may be added when UI work is authorized; no UI migration is included.

The original `Fintrox/` Blazor tree and `Fintrox.sln` are retained as legacy reference.
They are not part of the npm workspace and were not deleted or rewritten.
See [architecture](docs/architecture.md).
