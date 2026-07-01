import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { payoutFor } from './odds.js';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniquePlayerId(name, existing) {
  const base = slugify(name) || 'player';
  let id = base;
  let n = 2;
  while (existing.some((p) => p.id === id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

function seedState() {
  const now = Date.now();
  const players = [];
  for (const name of config.initialRoster) {
    players.push({
      id: uniquePlayerId(name, players),
      name,
      balance: config.defaultStartingBalance,
      isAdmin: false,
    });
  }
  return {
    startingBalance: config.defaultStartingBalance,
    players,
    events: [],
    bets: [],
    createdAt: now,
  };
}

let state = load();

function load() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    const seeded = seedState();
    persist(seeded);
    return seeded;
  }
}

function persist(s = state) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(s, null, 2));
}

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// --- lazy close-time transition -------------------------------------------

function applyCloseTimes() {
  const now = Date.now();
  let changed = false;
  for (const ev of state.events) {
    if (ev.status === 'open' && ev.closeTime && now >= ev.closeTime) {
      ev.status = 'locked';
      changed = true;
    }
  }
  if (changed) persist();
}

// --- players ----------------------------------------------------------------

export function listPlayers() {
  return state.players;
}

export function getPlayer(id) {
  return state.players.find((p) => p.id === id) || null;
}

export function addPlayer(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new AppError('Name is required.');
  if (state.players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new AppError('A player with that name already exists.');
  }
  const player = {
    id: uniquePlayerId(trimmed, state.players),
    name: trimmed,
    balance: state.startingBalance,
    isAdmin: false,
  };
  state.players.push(player);
  persist();
  return player;
}

export function removePlayer(id) {
  const idx = state.players.findIndex((p) => p.id === id);
  if (idx === -1) throw new AppError('Player not found.', 404);
  state.players.splice(idx, 1);
  persist();
}

export function setPlayerBalance(id, balance) {
  const player = getPlayer(id);
  if (!player) throw new AppError('Player not found.', 404);
  if (typeof balance !== 'number' || Number.isNaN(balance)) {
    throw new AppError('Balance must be a number.');
  }
  player.balance = balance;
  persist();
  return player;
}

export function getStartingBalance() {
  return state.startingBalance;
}

export function applyStartingBalanceToAll(amount) {
  if (typeof amount !== 'number' || Number.isNaN(amount) || amount < 0) {
    throw new AppError('Starting balance must be a non-negative number.');
  }
  state.startingBalance = amount;
  for (const p of state.players) p.balance = amount;
  persist();
  return state.players;
}

// --- events -------------------------------------------------------------------

export function listEvents() {
  applyCloseTimes();
  return state.events;
}

export function getEvent(id) {
  applyCloseTimes();
  return state.events.find((e) => e.id === id) || null;
}

function validateOutcomes(outcomes) {
  if (!Array.isArray(outcomes) || outcomes.length < 2) {
    throw new AppError('An event needs at least 2 outcomes.');
  }
  for (const o of outcomes) {
    if (!o.label || !String(o.label).trim()) {
      throw new AppError('Every outcome needs a label.');
    }
    const odds = Number(o.odds);
    if (!Number.isFinite(odds) || odds === 0 || (odds > -100 && odds < 100)) {
      throw new AppError(`Invalid American odds for "${o.label}". Use values like +150 or -200.`);
    }
  }
}

export function createEvent({ title, description, outcomes, closeTime }) {
  if (!title || !String(title).trim()) throw new AppError('Title is required.');
  validateOutcomes(outcomes);
  const event = {
    id: randomUUID(),
    title: title.trim(),
    description: (description || '').trim(),
    status: 'open',
    outcomes: outcomes.map((o) => ({
      id: randomUUID(),
      label: String(o.label).trim(),
      odds: Number(o.odds),
    })),
    closeTime: closeTime ? new Date(closeTime).getTime() : null,
    winningOutcomeId: null,
    createdAt: Date.now(),
    settledAt: null,
  };
  state.events.push(event);
  persist();
  return event;
}

export function updateEventOdds(id, outcomes) {
  const event = getEvent(id);
  if (!event) throw new AppError('Event not found.', 404);
  if (event.status !== 'open') throw new AppError('Only open events can have their odds edited.');
  validateOutcomes(outcomes);
  // Match incoming outcomes to existing ones by id when present, otherwise
  // treat as a new outcome. This lets admins add outcomes on the fly.
  const next = outcomes.map((o) => {
    const existing = o.id && event.outcomes.find((e) => e.id === o.id);
    return {
      id: existing ? existing.id : randomUUID(),
      label: String(o.label).trim(),
      odds: Number(o.odds),
    };
  });
  event.outcomes = next;
  persist();
  return event;
}

export function updateEventDetails(id, { title, description }) {
  const event = getEvent(id);
  if (!event) throw new AppError('Event not found.', 404);
  if (event.status !== 'open') throw new AppError('Only open events can be edited.');
  if (title !== undefined) {
    if (!String(title).trim()) throw new AppError('Title is required.');
    event.title = title.trim();
  }
  if (description !== undefined) event.description = description.trim();
  persist();
  return event;
}

export function lockEvent(id) {
  const event = getEvent(id);
  if (!event) throw new AppError('Event not found.', 404);
  if (event.status !== 'open') throw new AppError('Only open events can be locked.');
  event.status = 'locked';
  persist();
  return event;
}

export function reopenEvent(id) {
  const event = getEvent(id);
  if (!event) throw new AppError('Event not found.', 404);
  if (event.status !== 'locked') throw new AppError('Only locked events can be reopened.');
  event.status = 'open';
  persist();
  return event;
}

export function settleEvent(id, winningOutcomeId) {
  const event = getEvent(id);
  if (!event) throw new AppError('Event not found.', 404);
  if (event.status !== 'locked' && event.status !== 'open') {
    throw new AppError('Event is already settled.');
  }
  const winner = event.outcomes.find((o) => o.id === winningOutcomeId);
  if (!winner) throw new AppError('Winning outcome not found on this event.');

  const eventBets = state.bets.filter((b) => b.eventId === id && b.status === 'pending');
  for (const bet of eventBets) {
    const player = getPlayer(bet.playerId);
    if (bet.outcomeId === winningOutcomeId) {
      const payout = payoutFor(bet.wager, winner.odds);
      bet.status = 'won';
      bet.payout = payout;
      bet.settlementOdds = winner.odds;
      if (player) player.balance += payout;
    } else {
      bet.status = 'lost';
      bet.payout = 0;
      bet.settlementOdds = event.outcomes.find((o) => o.id === bet.outcomeId)?.odds ?? null;
    }
  }

  event.status = 'settled';
  event.winningOutcomeId = winningOutcomeId;
  event.settledAt = Date.now();
  persist();
  return event;
}

export function undoSettle(id) {
  const event = getEvent(id);
  if (!event) throw new AppError('Event not found.', 404);
  if (event.status !== 'settled') throw new AppError('Event is not settled.');

  const eventBets = state.bets.filter(
    (b) => b.eventId === id && (b.status === 'won' || b.status === 'lost')
  );
  for (const bet of eventBets) {
    const player = getPlayer(bet.playerId);
    if (bet.status === 'won' && player) {
      player.balance -= bet.payout;
    }
    bet.status = 'pending';
    bet.payout = null;
    bet.settlementOdds = null;
  }

  event.status = 'locked';
  event.winningOutcomeId = null;
  event.settledAt = null;
  persist();
  return event;
}

// --- bets -----------------------------------------------------------------------

export function listBets({ playerId, eventId } = {}) {
  let bets = state.bets;
  if (playerId) bets = bets.filter((b) => b.playerId === playerId);
  if (eventId) bets = bets.filter((b) => b.eventId === eventId);
  return bets;
}

export function placeBet({ playerId, eventId, outcomeId, wager }) {
  const player = getPlayer(playerId);
  if (!player) throw new AppError('Player not found.', 404);
  const event = getEvent(eventId);
  if (!event) throw new AppError('Event not found.', 404);
  if (event.status !== 'open') throw new AppError('This event is no longer accepting bets.');
  const outcome = event.outcomes.find((o) => o.id === outcomeId);
  if (!outcome) throw new AppError('Outcome not found on this event.');

  const amount = Number(wager);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('Wager must be a positive number.');
  }
  if (amount > player.balance) {
    throw new AppError('You cannot bet more than your current balance.');
  }

  player.balance -= amount;
  const bet = {
    id: randomUUID(),
    eventId,
    playerId,
    outcomeId,
    wager: amount,
    oddsAtBetTime: outcome.odds,
    status: 'pending',
    payout: null,
    settlementOdds: null,
    placedAt: Date.now(),
  };
  state.bets.push(bet);
  persist();
  return bet;
}

export { AppError };
