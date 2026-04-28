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
  - Availability toggle.
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
- Header includes a Record button for seminar transcripts, with a per-device profile toggle stored in localStorage.
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

### Android tablet Otter app links

The header Record button is a normal HTTPS link to `https://otter.ai/home`.

Android App Links can open verified website URLs in an installed app on Android 6+; otherwise the URL opens on the web. Otter publishes `https://otter.ai/.well-known/assetlinks.json` for the Play Store package `com.aisense.otter`. Otter's `apple-app-site-association` lists `/home`, `/my-notes`, `/all-notes`, `/my-agenda`, and `/newrecording`.

Setup for seminar tablets:

1. Install Otter from Google Play and sign in.
2. In Firefox for Android, open menu -> Settings -> Advanced -> Open links in apps.
3. Select `Always` or `Ask before opening`. Mozilla documents this setting as disabled by default.
4. Tap the Record button in AFFINE Tech Tree and confirm any prompt to open Otter.

Sources: [Android App Links](https://developer.android.com/training/app-links/about), [Otter asset links](https://otter.ai/.well-known/assetlinks.json), [Otter Apple app links](https://otter.ai/.well-known/apple-app-site-association), [Firefox for Android](https://support.mozilla.org/en-US/kb/set-firefox-android-open-links-native-apps).

### Environment variables

| Variable             | Description                                                           |
| -------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`       | SQLite connection string (default: `file:./db.sqlite`)                |
| `BETTER_AUTH_SECRET` | Secret for Better Auth sessions (required in production)              |
| `BETTER_AUTH_URL`    | Production base URL for Better Auth origin checks (optional locally)  |
| `BETTER_AUTH_DISCORD_CLIENT_ID` / `_SECRET` | Optional Discord OAuth credentials. When both are set, a "Continue with Discord" button appears on `/auth`. Discord sign-ins auto-link to an existing account with the same verified email. |
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
