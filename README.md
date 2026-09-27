# Fintrox.Client

Next.js App Router + TypeScript frontend for Fintrox.Server (ASP.NET Core Web API / PostgreSQL).

## Frontend standard

The active frontend is TypeScript-only:

- application source uses `.ts` and `.tsx`;
- `allowJs` is disabled;
- TypeScript strict mode is enabled;
- architecture checks reject JavaScript/JSX source inside `apps/web/src`;
- frontend tooling in `scripts/` is TypeScript as well.

The previous Blazor client has been removed from the active tree. It remains available in Git history if a later migration needs to reference an old screen or behavior.

## Local commands

```bash
npm ci
npm run dev
npm run check
npm run build
```

Use Node 22.6+; dev runs at http://localhost:3000. Run commands from the repository root.
`apps/web/.env.example` reserves the API base URL. No API calls or credentials are needed
for the skeleton. Production: `npm run build` then `npm start` (supports `PORT`).

## Structure

- `apps/web/src/app`: thin Next.js routing/layout; reserved auth/workspace groups.
- `apps/web/src/modules`: 23 business modules aligned with the backend catalog.
- `apps/web/src/shared`: reusable presentation, config and generated API types; no financial rules.
- `apps/web/src/composition`: future cross-module UI composition.
- `architecture/modules.json`: ownership inventory matching the server.
- `tests`: future contract and end-to-end tests.
- `scripts`: TypeScript repository/architecture tooling.

The current screen is only a neutral application shell. Business pages, API calls,
authentication, design system and feature behavior are intentionally unimplemented.
Tailwind/shadcn may be added when UI work is authorized; no business implementation is included.

## Activatable integrations and experience structure

See [ownership and lifecycle](docs/activation-experience.md). Capabilities and Experience are new structural boundaries; Integrations owns external app installations. Simple / Accountant / Expert are customizable UI presets, independent of permissions. No activation or layout behavior is implemented.
