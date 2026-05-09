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
  - Availability toggle.
  - View feedback left about this user by others.
  - Become admin (when honor system is enabled).
- Authentication is Discord-only. The first Discord login creates an account; subsequent logins re-use it.
- A Discord login whose verified email matches an existing user (e.g. a non-user teacher placeholder added by an admin) attaches to that user instead of creating a duplicate, and promotes the placeholder to a real user.
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
- Topic detail shows "Related Topics" section with prerequisites and dependents (below "Add resource").
- Header includes a link to the GitHub repository.
- Header includes a Record button (`/record`) that records seminar audio in-browser via `MediaRecorder`, streaming chunks every second to OPFS through a worker so a crash or battery loss only loses the last second.
- Test/staging deployments show a "Test env" badge with deploy date, commit link, and production URL.
- Prerequisite network graph (`/graph`): clicking a node opens a sticky preview column on the right with a slide-in reveal; the column follows the page as you scroll and tucks up above the footer. On tablet+ it caps at 60% of the viewport and the graph gets matching right-padding so SVG content can scroll out from under it; on phones the preview takes over the screen. Selection is reflected in the URL (`?topic=<id>`) so browser back/forward walks selection history. Selected (orange), hovered (neutral), and idle nodes/edges use distinct color tiers.
- Progress pages (`/progress/{userId}`) show a cumulative stacked chart of understanding levels over time, with a hover/click tooltip listing that day's per-level totals and topic transitions. User profiles link to the corresponding progress page; admins can view other users' progress there too.
- User segments (SAS, Online SAS, BARYCENTER) and peer match system:
  - Admins assign each user to a segment from the user profile page.
  - `/match` lists peers in your own segment with their starred topics.
  - Clicking a peer prompts to send a match request; the recipient can accept
    or decline.
  - Accepted matches open `/match/[id]`, with a venue wayfinding map at the top
    where either user can click to set a shared "meet here" orange dot
    (stored on the match row), followed by a sorted list of tuition topics:
    topics where one side can teach and the other is at a lower level, ranked
    by learner bookmark, teacher star, "advanced" level, then the topic
    prioritization from the sheet.

## Dev

```sh
cp .env.example .env   # then fill in values
pnpm i
pnpm dev
```

### In-browser audio recording (`/record`)

The header Record button opens `/record`, an in-browser recorder built on `MediaRecorder` + the Origin Private File System (OPFS). A dedicated Web Worker holds a `FileSystemSyncAccessHandle` and `flush()`es every chunk, so each 1s slice is durable on disk; the tab can crash or the battery can die and only the last second is lost.

Container/codec is auto-picked from what the browser supports (`audio/webm;codecs=opus` on Chrome/Firefox, `audio/mp4` on Safari). A Screen Wake Lock keeps the screen on while recording.

When the user taps **Stop**, the file stays in OPFS until they tap **Download**, which copies it to the device's `Downloads/` folder. From there the user uploads it to Google Drive (or any other destination).

Browser support: requires `MediaRecorder`, `getUserMedia`, OPFS, and `FileSystemSyncAccessHandle`. Up-to-date Chrome / Edge / Firefox on Android, plus desktop equivalents, are supported. Other browsers see an explicit "not supported" message instead of a degraded path.

### Environment variables

| Variable                            | Description                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                      | SQLite connection string (default: `file:./db.sqlite`)                                         |
| `BETTER_AUTH_SECRET`                | Secret for Better Auth sessions (required in production; generate via `openssl rand -base64 32`) |
| `BETTER_AUTH_URL`                   | Canonical base URL for Better Auth origin checks (optional locally; required for Vercel previews if you want OAuth there — pin to the per-branch alias) |
| `BETTER_AUTH_DISCORD_CLIENT_ID`     | Discord application client ID (required to sign in)                                             |
| `BETTER_AUTH_DISCORD_CLIENT_SECRET` | Discord application client secret (required to sign in)                                         |
| `AIRTABLE_API_KEY`                  | Legacy. No longer required — topics now sync from a public Google Sheet                          |

### Discord OAuth setup

Authentication is Discord-only, so the app requires a Discord application before anyone can sign in.

1. Open https://discord.com/developers/applications and click **New Application**. Name it (e.g. "AFFINE Tech Tree").
2. Left sidebar → **OAuth2**. Copy the **Client ID** and click **Reset Secret** to obtain the **Client Secret** (shown only once).
3. Under **Redirects**, register every URL the app will be reached at. Each entry must be exact (no trailing slash, correct protocol/port). Examples:
   - `http://localhost:3000/api/auth/callback/discord`
   - `https://<production-domain>/api/auth/callback/discord`
   - `https://affine-tech-tree-git-<branch>-<vercel-scope>.vercel.app/api/auth/callback/discord` (per-branch preview alias)
4. **Save Changes**. Discord rejects any callback URL not on this list.

Local `.env.local` (gitignored — never commit, never deploy):

```
BETTER_AUTH_DISCORD_CLIENT_ID="..."
BETTER_AUTH_DISCORD_CLIENT_SECRET="..."
```

Vercel: set the same two variables (and `BETTER_AUTH_SECRET`, `DATABASE_URL`) for each environment (Production / Preview) via dashboard or CLI:

```sh
vercel env add BETTER_AUTH_DISCORD_CLIENT_ID production
vercel env add BETTER_AUTH_DISCORD_CLIENT_ID preview
vercel env add BETTER_AUTH_DISCORD_CLIENT_SECRET production
vercel env add BETTER_AUTH_DISCORD_CLIENT_SECRET preview
```

Mark the secret as **Sensitive** in the Vercel UI to keep it out of `vercel env pull`. After adding env vars, redeploy — Vercel does not hot-reload env into existing deploys.

The same Discord application can hold many redirect URIs, so reuse one client across local + production + previews. Production deployment is handled by another team member; coordinate to ensure the production redirect URI is on the list before they ship.

#### Migrating legacy email/password users

Users who registered with email/password before the switch can sign in with Discord using a Discord account whose **verified email matches** the one stored on their record — Better Auth attaches the new Discord identity to the existing user (preserving topic data, feedback, roles, etc.). If their Discord email differs, an admin must update the `user.email` row to match the Discord email before that user's first Discord login.

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
vercel env add BETTER_AUTH_DISCORD_CLIENT_ID      # from Discord developer portal
vercel env add BETTER_AUTH_DISCORD_CLIENT_SECRET  # from Discord developer portal (mark Sensitive)
pnpm run deploy                                   # deploy (passes git commit/date to the Vercel build)
```

After the first deploy, set the canonical URL and redeploy:

```sh
vercel env add BETTER_AUTH_URL                    # paste aliased URL (e.g. https://learn.affi.ne)
pnpm run deploy
```

Then add `https://<that-url>/api/auth/callback/discord` to the Discord application's redirect list (see "Discord OAuth setup" above).

Alternatively, import the repo in the [Vercel dashboard](https://vercel.com/new), set the environment variables there, and deploy from the UI.
