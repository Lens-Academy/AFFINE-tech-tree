# AFFINE tech tree

WIP web app for https://affi.ne/ seminar participants to track understanding of AI Alignment foundation topics.

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## Current Product Features

- Authenticated users can set/remove their understanding level per topic.
- Every level change is recorded as a transition (`from -> to`), including removals.
- After changing a level, users get a toast linking to `/topic/{id}#feedback`.
- Topic detail includes a feedback section:
  - Latest transition suggests resources and teachers for quick rating/commenting.
  - Older transitions show only data saved for that transition (historical snapshot behavior).
  - Rating and comment autosaves are independent to avoid clobbering fast edits.
  - Free-text feedback items can be added and removed.
  - Free-text URLs/emails/names are auto-linked when exact matches are found.
  - Free-text links can be promoted into topic resources and paired.
- Header includes a notification bell with recent transitions and pending feedback signal.
- Admin area (`/admin`) supports non-user teacher management:
  - DB-backed admin role checks (no env-based admin list).
  - Bootstrap flow for first admin user.
  - Admin user management (grant/revoke admin role).
  - CRUD for non-user teachers with topic assignments.
  - Feedback-linking review page with exact/fuzzy suggestions.
  - Optional deletion mode to also purge teaching-status history.
- Sign-up deduplicates non-user teacher emails by claiming and converting records.

## Dev

```sh
cp .env.example .env   # then fill in values
pnpm i
pnpm dev
```

### Environment variables

| Variable                | Description                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | SQLite connection string (default: `file:./db.sqlite`)                                                  |
| `BETTER_AUTH_SECRET`    | Secret for Better Auth sessions (required in production)                                                |
| `AFFINE_SHEETS_API_KEY` | Google API key with Sheets API enabled — needed by `db:sync` to extract hyperlinks from the spreadsheet |

To create an `AFFINE_SHEETS_API_KEY`: [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), enable the **Google Sheets API**, then create an API key.

### Database

Import data from https://docs.google.com/spreadsheets/d/16BG0Fw7mOOHJykBVLkeqPzlpdxgMMp1_YeSmgaFnKLc

```sh
pnpm db:sync
```

When schema changes are introduced (for example feedback/transition tables), run:

```sh
pnpm db:generate
pnpm db:migrate
```

### How do I deploy this?

Follow T3 deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.

#### Cloudflare Workers

Requires [Wrangler](https://developers.cloudflare.com/workers/wrangler/), a Cloudflare account, and [`sqlite3`](https://sqlite.org/cli.html) CLI (`sudo apt install sqlite3` on Debian/Ubuntu/WSL2).

```sh
cp wrangler.jsonc.example wrangler.jsonc    # then fill in account_id and database_id
pnpm wrangler login                         # one-time auth
pnpm wrangler secret put BETTER_AUTH_SECRET # paste the value from .env
pnpm db:upload:cf                           # copy local db.sqlite → D1 (replaces everything)
pnpm db:download:cf                         # copy D1 → local db.sqlite (replaces local file)
pnpm deploy:cf                              # build Next.js as a Worker and deploy
```
