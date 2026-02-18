# AFFINE Tech Tree

Training material progress tracker for the AFFINE Seminar. Users track their understanding level per topic (synced from a Google Sheet).

## Stack

- Next.js 15 (Pages Router)
- tRPC
- Drizzle ORM
- SQLite — libSQL (local dev) / D1 (Cloudflare Workers)
- Cloudflare Workers (@opennextjs/cloudflare)
- Better Auth (email/password)
- Tailwind CSS 4
- `sqlite3` CLI required for `pnpm db:upload:cf` (`sudo apt install sqlite3`)

## Project Principles

- **Optimize for change**: Small files, clear interfaces, easy to delete or replace. Prefer composition over inheritance.
- **Boring tech**: Prefer well-established, high-download-count dependencies over trendy ones. Avoid churn.
- **No vendor lock-in**: Use standard APIs and portable abstractions; avoid platform-specific features where a standard exists.
- **TypeScript conventions**: No `enum` keyword. Use `z.enum()` for discriminated unions; derive types with `z.infer<>`. Infer return types, don't use `as any`.
- **Testing**: Test non-trivial business logic (parsing, transformations, validation). Don't test what is already type-checked; if types can express a constraint, fix the types instead of adding a test. Don't test things that would fail trivially when rendered (e.g. "component doesn't crash").
