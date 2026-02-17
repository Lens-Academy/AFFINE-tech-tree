# AFFINE tech tree

WIP web app for https://affi.ne/ seminar participants to track understanding of AI Alignment foundation topics.

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## Dev

```sh
cp .env.example .env   # then fill in values
pnpm i
pnpm dev
```

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite connection string (default: `file:./db.sqlite`) |
| `BETTER_AUTH_SECRET` | Secret for Better Auth sessions (required in production) |
| `AFFINE_SHEETS_API_KEY` | Google API key with Sheets API enabled — needed by `db:sync` to extract hyperlinks from the spreadsheet |

To create an `AFFINE_SHEETS_API_KEY`: [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), enable the **Google Sheets API**, then create an API key.

### Database

Import data from https://docs.google.com/spreadsheets/d/16BG0Fw7mOOHJykBVLkeqPzlpdxgMMp1_YeSmgaFnKLc

```sh
pnpm db:sync
```

### How do I deploy this?

Follow T3 deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.
