# T-6A Practice

A hostable T-6A Boldface and Ops Limits practice site with exact-match grading, run timers, optional names, dark mode, combined runs, and a shared leaderboard.

Live site:

```text
https://czarkula.github.io/t6-study/
```

## Pages

- `index.html` - landing page
- `boldface.html` - Boldface practice
- `ops.html` - Ops Limits practice
- `leaderboard.html` - shared fastest-times page

## Leaderboard

The shared leaderboard should be working through the deployed Cloudflare Worker:

```text
https://t6-study-leaderboard.mattsharkey143.workers.dev
```

The frontend points to that Worker in `static/js/config.js`:

```js
window.T6_BACKEND_URL = "https://t6-study-leaderboard.mattsharkey143.workers.dev";
```

Scores are submitted only after an all-correct check. Boldface, Ops Limits, and Both/combined runs are saved as separate leaderboard types. If the Worker is unavailable, the site falls back to local browser scores so practice still works.

Quick backend checks:

```powershell
Invoke-RestMethod "https://t6-study-leaderboard.mattsharkey143.workers.dev/health"
Invoke-RestMethod "https://t6-study-leaderboard.mattsharkey143.workers.dev/scores"
```

## Cloudflare Backend

The preferred free backend is Cloudflare Workers + D1. The Worker code lives in `backend-cloudflare/`.

Setup/deploy commands:

```powershell
cd backend-cloudflare
copy wrangler.toml.example wrangler.toml
npx.cmd wrangler login
npx.cmd wrangler d1 create t6_study_leaderboard
```

Paste the created database id into `wrangler.toml`, and make sure the binding is named `DB` because the Worker code uses `env.DB`.

Then initialize the remote database and deploy:

```powershell
npx.cmd wrangler d1 execute t6_study_leaderboard --remote --file schema.sql
npx.cmd wrangler deploy
```

If the database already existed before combined runs were added, run this migration before deploying the updated Worker:

```powershell
npx.cmd wrangler d1 execute t6_study_leaderboard --remote --file migration-combined-kind.sql
npx.cmd wrangler deploy
```

`backend-cloudflare/wrangler.toml` is intentionally local-only because it contains deployment-specific database settings.

There is also a simple Node backend in `backend/`, but Cloudflare Workers + D1 is the intended shared setup for the GitHub Pages site.

## Current Features

- Modern dark landing page with optional name entry and a shark image.
- Separate leaderboard page instead of making the leaderboard the homepage.
- Practice buttons labeled simply `Boldface` and `Ops Limits`.
- Combined `Both` mode starts with Boldface, rolls into Ops Limits, and saves one combined time after both are completed correctly.
- Optional names. Blank names save/display as `Anonymous`.
- Millisecond timer display with three decimal places.
- Centered modern `Check` and `Show Answers` buttons.
- Dark/light toggle on the Boldface and Ops Limits practice pages.
- Paste, drag/drop, and context-menu paste disabled on answer fields.
- Shared leaderboard for fastest completed runs, with local fallback.
- Strict answer checking: exact text, punctuation, casing, commas, internal spacing, and line breaks are required. Only leading/trailing whitespace, trailing spaces at line ends, and browser line-ending differences are ignored.

## Corrections Made

- Converted original `/uct/...` asset and nav links to local relative paths.
- Removed unrelated/broken nav links so the package can be hosted as a standalone site.
- Fixed malformed HTML in the ops page.
- Updated the displayed revision date to `01 June 2023`.
- Fixed visible typos: `Maxmimum` to `Maximum`, `Aggrivated` to `Aggravated`.
- Fixed spacing before the tailwind answer field.
- Corrected Engine maximum torque transient limits to `101 % to 107 % ( 5 seconds )` and torque malfunction threshold to `107 %`.
- Aligned answer blanks in the Engine maximum torque and maximum ITT sections.
- Set Ops Limits tab order to move down the left column before moving to the right column.
- Updated boldface entries for the prop system circuit breaker location note, physiological symptoms, and OBOGS/OXY CRIT wording.
- Kept `If Fire is Confirmed,` on one line in Fire In Flight.
- Tightened several shorter Boldface answer boxes to reduce extra whitespace.
- Fixed the boldface answer reveal code to update textareas reliably.

This package preserves the downloaded answer data plus the corrections above. Verify the limits against your current approved source before using it for official study.
