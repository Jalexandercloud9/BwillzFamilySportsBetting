# Bwillz Family Sportsbook

A fake-money sportsbook for a family sports outing. One admin creates betting
events with American odds on the fly, everyone else picks their name and bets
play money, and the admin settles each event when the outcome is known.
Balances update automatically.

No real money, no accounts/passwords, no external services required.

## Running it

```bash
npm install
npm start
```

Then open `http://localhost:3000` on any device on the same network (or
deploy it — see below). Everyone shares the same live state through the
server; there's nothing to configure per-device.

For local development with auto-restart on file changes:

```bash
npm run dev
```

## Configuration

Set these environment variables before starting the server (defaults shown):

| Variable          | Default                             | Purpose                                   |
|-------------------|--------------------------------------|--------------------------------------------|
| `ADMIN_PIN`       | `2580`                              | PIN to unlock the Admin panel              |
| `STARTING_BALANCE`| `1000`                              | Fake dollars each player starts with       |
| `INITIAL_ROSTER`  | `Dad,Mom,Uncle Rick,Sarah,Justin`   | Comma-separated starting player names      |
| `PORT`            | `3000`                              | HTTP port                                  |

**Change `ADMIN_PIN` before a real event.** It's stored in plain text and
checked on every admin request — good enough to keep siblings out of the
admin panel, not a real security boundary.

Example:

```bash
ADMIN_PIN=4477 STARTING_BALANCE=500 INITIAL_ROSTER="Dad,Mom,Sarah,Rick" npm start
```

The roster can also be edited live from the Admin > Roster & Balances tab
after the app is running — the env var only sets the initial seed.

## Architecture

Single Node/Express server serves both the REST API and the static frontend
(plain HTML/CSS/JS, no build step, no framework). Shared state — players,
events, bets — lives in a JSON file (`data/db.json`, created automatically,
gitignored) on the server, so every device sees the same odds and balances.
Clients poll the server every few seconds to stay in sync.

Deploy anywhere that runs Node (Render, Railway, Fly.io, a VPS, etc.) — the
JSON file persists on that host's disk between requests, but won't survive a
platform that wipes the filesystem between deploys/restarts (fine for a
single-day family event; if you need it to survive redeploys, swap
`server/store.js` for a real database).

## How it works

- **Players** pick their name from the roster on first visit (no password);
  the choice is remembered on that device via `localStorage`.
- **Admin** unlocks the Admin panel with a PIN (`I'm the admin` link in the
  footer) to create events, edit odds, lock/settle/undo, and manage the
  roster and balances.
- **Events** move through `open` → `locked` → `settled`. Players can only bet
  while an event is open.
- **Odds** are American format (e.g. `+150`, `-200`). Payout math lives in
  `server/odds.js`, covered by tests in `server/odds.test.js` — run them with
  `npm test`.

### Explicit rules (to avoid ambiguity)

- Odds changes on an open event apply to **all** bets on that outcome —
  including ones already placed — at settlement time, not at bet time. Each
  event card shows a disclaimer about this.
- A wager is deducted from the player's balance immediately when the bet is
  placed. Losing bets don't get the wager back. Winning bets get the full
  payout (wager + profit) credited at settlement.
- **Undo Settlement** reverses the payouts that were paid out and returns the
  event to `locked` (bets go back to `pending`, still at risk) so the admin
  can fix a mistake and re-settle with the correct winner. It does not refund
  original wagers — those were already at risk the moment the bet was placed.

## Project layout

```
server/
  index.js      Express app + routes
  store.js      JSON-file persistence + business logic (bets, settlement)
  odds.js       American odds math (pure functions)
  odds.test.js  Tests for the odds math
  config.js     Admin PIN / starting balance / initial roster
public/
  index.html
  css/styles.css
  js/           Vanilla JS SPA (api.js, state.js, format.js, views/, app.js)
```
