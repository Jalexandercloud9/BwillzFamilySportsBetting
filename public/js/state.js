const PLAYER_KEY = 'sb_playerId';
const ADMIN_PIN_KEY = 'sb_adminPin';

export const state = {
  players: [],
  events: [],
  bets: [],
  startingBalance: 0,
  currentPlayerId: localStorage.getItem(PLAYER_KEY) || null,
  adminPin: localStorage.getItem(ADMIN_PIN_KEY) || null,
  tab: 'events',
  adminSubtab: 'create',
};

export function setCurrentPlayer(id) {
  state.currentPlayerId = id;
  if (id) localStorage.setItem(PLAYER_KEY, id);
  else localStorage.removeItem(PLAYER_KEY);
}

export function setAdminPin(pin) {
  state.adminPin = pin;
  if (pin) localStorage.setItem(ADMIN_PIN_KEY, pin);
  else localStorage.removeItem(ADMIN_PIN_KEY);
}

export function isAdmin() {
  return Boolean(state.adminPin);
}

export function currentPlayer() {
  return state.players.find((p) => p.id === state.currentPlayerId) || null;
}

export function applyServerState(data) {
  state.players = data.players || [];
  state.events = data.events || [];
  state.bets = data.bets || [];
  state.startingBalance = data.startingBalance || 0;
}
