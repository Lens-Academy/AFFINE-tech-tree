# AFFINE Tech Tree

Training material progress tracker for the AFFINE Seminar. Users track their understanding level per topic (synced from an Airtable base).
Admins can optionally require approval for newly self-created user accounts.

## Stack

- Next.js 15 (Pages Router)
- tRPC
- Drizzle ORM
- SQLite via libSQL (`@libsql/client`)
- Deployment target: Vercel
- Better Auth (email/password)
- Tailwind CSS 4

## Project Principles

- Optimize for change: prefer small files, clear interfaces, and code that is easy to replace or delete.
- Use boring tech: favor well-established, high-download-count dependencies over trendy options.
- Avoid vendor lock-in: prefer standard APIs and portable components when possible.
- TypeScript conventions: do not use `enum`; use `z.enum()` for discriminated unions, derive types with `z.infer<>`, infer return types, and do not use `as any`.
- Testing: focus on non-trivial business logic such as parsing, transformation, and validation. Do not test what the type system already guarantees.
- No dual paths by default: when behavior is changed, remove the old implementation, never keep both.
- Date formatting: always use `formatDate()` from `~/shared/formatDate` - never call `toLocaleString()` / `toLocaleDateString()` directly. Renders as `YYYY-MM-DD HH:MM:SS`.
- `pnpm check` and `pnpm format:write` when everything is finished, double check README.md and AGENTS.md are in sync with added features.
- Aim for as complex as necessary, as simple as possible.
