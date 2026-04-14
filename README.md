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
- User profile page (`/user/[id]`):
  - Edit name and email.
  - Change password (self) or generate a password reset link (admin viewing another user).
  - Availability toggle with GPS tracking.
  - View feedback left about this user by others.
  - Become admin (when honor system is enabled).
- Auth page shows sign-up and sign-in side by side with shared fields.
- Admin area (`/admin`) supports non-user teacher management:
  - DB-backed admin role checks (no env-based admin list).
  - Bootstrap flow for first admin user.
  - Honor system toggle for self-service admin promotion.
  - Toggle to require admin approval for new self-created accounts.
  - Pending users are blocked from protected features until approved.
  - User list links to user profile pages (admin can view/edit any user).
  - CRUD for non-user teachers with topic assignments.
  - Feedback-linking review page with exact/fuzzy suggestions.
  - Feedback overview with per-topic statistics and transition matrices.
  - Optional deletion mode to also purge teaching-status history.
- Sign-up deduplicates non-user teacher emails by claiming and converting records.
- Topic detail shows "Related Topics" section with prerequisites and dependents (below "Add resource").
- Header includes a link to the GitHub repository.
- Test/staging deployments show a "Test env" badge with deploy date, commit link, and production URL.
- Admin area includes a prerequisite network graph visualization (`/graph`).

## Dev

```sh
cp .env.example .env   # then fill in values
pnpm i
pnpm dev
```

### Environment variables

| Variable             | Description                                                           |
| -------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`       | SQLite connection string (default: `file:./db.sqlite`)                |
| `BETTER_AUTH_SECRET` | Secret for Better Auth sessions (required in production)              |
| `BETTER_AUTH_URL`    | Production base URL for Better Auth origin checks (optional locally)  |
| `AIRTABLE_API_KEY`   | No longer required — topics are synced from Google Sheets |

### Database

Import data from the public Google Sheet (Topics and Resources sheets):

```sh
pnpm db:sync
```

No API key required — the sheet is fetched directly from its public URL.

When schema changes are introduced (for example feedback/transition tables), run:

```sh
pnpm db:generate
pnpm db:migrate
```

### Deployment (Vercel + Turso)

#### 1. Create a Turso database

```sh
curl -sSfL https://get.tur.so/install.sh | bash   # install Turso CLI
turso auth signup                                 # or: turso auth login
turso db create affine-tech-tree
turso db show affine-tech-tree --url              # → libsql://affine-tech-tree-<org>.turso.io
turso db tokens create affine-tech-tree           # → auth token
```

#### 2. Push schema and seed data

Update `DATABASE_URL` in `.env` to the Turso URL:

```
DATABASE_URL="libsql://affine-tech-tree-<org>.turso.io?authToken=<token>"
```

Then push the schema and seed topics:

```sh
pnpm db:push
pnpm db:sync
```

#### 3. Deploy to Vercel

```sh
pnpm add -g vercel                                # install Vercel CLI
vercel link                                       # link repo to a Vercel project
vercel env add DATABASE_URL                       # paste Turso URL with ?authToken=…
vercel env add BETTER_AUTH_SECRET                 # generate: openssl rand -base64 32
pnpm run deploy                                   # deploy (passes git commit/date to the Vercel build)
```

After the first deploy, set the production URL and redeploy:

```sh
vercel env add BETTER_AUTH_URL                    # paste Aliased URL (e.g. https://learn.affi.ne)
pnpm run deploy                                   # redeploy with the new variable
```

Alternatively, import the repo in the [Vercel dashboard](https://vercel.com/new), set the environment variables there, and deploy from the UI.
