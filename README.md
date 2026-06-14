# T-6A Practice

Static practice pages derived from the downloaded T-6A boldface and ops limits pages.

## Pages

- `index.html`
- `leaderboard.html`
- `boldface.html`
- `ops.html`

## Shared Leaderboard Backend

The frontend works without a backend, but scores are browser-local until `static/js/config.js` contains a deployed backend URL.

The included backend is in `backend/` and uses plain Node with a JSON file:

```powershell
cd backend
npm start
```

Local API URL:

```text
http://localhost:3000
```

After deploying the backend, set this in `static/js/config.js`:

```js
window.T6_BACKEND_URL = "https://your-backend-url.example";
```

## Corrections Made

- Added a simple dark landing page with name entry and a cool little shark picture.
- Added a separate leaderboard page for fastest times.
- Added run timers for Boldface and Ops Limits. Times save only after an all-correct check.
- Disabled paste, drag/drop, and context-menu paste on answer fields.
- Converted original `/uct/...` asset and nav links to local relative paths.
- Removed unrelated/broken nav links so the package can be hosted as a standalone site.
- Fixed malformed HTML in the ops page.
- Fixed visible typos: `Maxmimum` to `Maximum`, `Aggrivated` to `Aggravated`.
- Fixed spacing before the tailwind answer field.
- Corrected Engine maximum torque transient limits to `101 % to 107 % ( 5 seconds )` and torque malfunction threshold to `107 %`.
- Aligned answer blanks in the Engine maximum torque and maximum ITT sections.
- Updated boldface entries for the prop system circuit breaker location note, physiological symptoms, and OBOGS/OXY CRIT wording.
- Fixed the boldface answer reveal code to update textareas reliably.
- Made answer checking strict: exact text, punctuation, casing, commas, internal spacing, and line breaks are required. Only leading/trailing whitespace, trailing spaces at line ends, and browser line-ending differences are ignored.

This package preserves the downloaded answer data. Verify the limits against your current approved source before using it for official study.
