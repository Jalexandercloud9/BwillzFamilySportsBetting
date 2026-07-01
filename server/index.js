import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import * as store from './store.js';
import { AppError } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.use(express.json());

function requireAdmin(req, res, next) {
  const pin = req.header('x-admin-pin');
  if (pin !== config.adminPin) {
    return res.status(403).json({ error: 'Invalid admin PIN.' });
  }
  next();
}

function wrap(handler) {
  return (req, res) => {
    try {
      handler(req, res);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong.' });
      }
    }
  };
}

// --- combined state (single poll target) ---------------------------------

app.get(
  '/api/state',
  wrap((req, res) => {
    res.json({
      players: store.listPlayers(),
      events: store.listEvents(),
      bets: store.listBets(),
      startingBalance: store.getStartingBalance(),
    });
  })
);

// --- admin auth -------------------------------------------------------------

app.post(
  '/api/admin/login',
  wrap((req, res) => {
    const { pin } = req.body || {};
    if (pin !== config.adminPin) {
      return res.status(403).json({ error: 'Incorrect PIN.' });
    }
    res.json({ ok: true, token: config.adminPin });
  })
);

// --- bets (players) ----------------------------------------------------------

app.post(
  '/api/bets',
  wrap((req, res) => {
    const { playerId, eventId, outcomeId, wager } = req.body || {};
    const bet = store.placeBet({ playerId, eventId, outcomeId, wager });
    res.status(201).json(bet);
  })
);

// --- admin: roster ------------------------------------------------------------

app.post(
  '/api/admin/roster',
  requireAdmin,
  wrap((req, res) => {
    const player = store.addPlayer(req.body?.name);
    res.status(201).json(player);
  })
);

app.delete(
  '/api/admin/roster/:id',
  requireAdmin,
  wrap((req, res) => {
    store.removePlayer(req.params.id);
    res.status(204).end();
  })
);

app.patch(
  '/api/admin/roster/:id',
  requireAdmin,
  wrap((req, res) => {
    const player = store.setPlayerBalance(req.params.id, Number(req.body?.balance));
    res.json(player);
  })
);

app.post(
  '/api/admin/starting-balance',
  requireAdmin,
  wrap((req, res) => {
    const players = store.applyStartingBalanceToAll(Number(req.body?.amount));
    res.json(players);
  })
);

// --- admin: events --------------------------------------------------------------

app.post(
  '/api/admin/events',
  requireAdmin,
  wrap((req, res) => {
    const event = store.createEvent(req.body || {});
    res.status(201).json(event);
  })
);

app.patch(
  '/api/admin/events/:id/odds',
  requireAdmin,
  wrap((req, res) => {
    const event = store.updateEventOdds(req.params.id, req.body?.outcomes);
    res.json(event);
  })
);

app.patch(
  '/api/admin/events/:id/details',
  requireAdmin,
  wrap((req, res) => {
    const event = store.updateEventDetails(req.params.id, req.body || {});
    res.json(event);
  })
);

app.post(
  '/api/admin/events/:id/lock',
  requireAdmin,
  wrap((req, res) => {
    res.json(store.lockEvent(req.params.id));
  })
);

app.post(
  '/api/admin/events/:id/reopen',
  requireAdmin,
  wrap((req, res) => {
    res.json(store.reopenEvent(req.params.id));
  })
);

app.post(
  '/api/admin/events/:id/settle',
  requireAdmin,
  wrap((req, res) => {
    res.json(store.settleEvent(req.params.id, req.body?.winningOutcomeId));
  })
);

app.post(
  '/api/admin/events/:id/undo-settle',
  requireAdmin,
  wrap((req, res) => {
    res.json(store.undoSettle(req.params.id));
  })
);

app.use(express.static(PUBLIC_DIR));
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Family Sportsbook running at http://localhost:${PORT}`);
});
