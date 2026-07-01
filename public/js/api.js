const BASE = '/api';

async function request(path, { method = 'GET', body, adminPin } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (adminPin) headers['x-admin-pin'] = adminPin;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  getState: () => request('/state'),
  adminLogin: (pin) => request('/admin/login', { method: 'POST', body: { pin } }),

  placeBet: (payload) => request('/bets', { method: 'POST', body: payload }),

  addRosterPlayer: (name, adminPin) =>
    request('/admin/roster', { method: 'POST', body: { name }, adminPin }),
  removeRosterPlayer: (id, adminPin) =>
    request(`/admin/roster/${id}`, { method: 'DELETE', adminPin }),
  setPlayerBalance: (id, balance, adminPin) =>
    request(`/admin/roster/${id}`, { method: 'PATCH', body: { balance }, adminPin }),
  setStartingBalanceForAll: (amount, adminPin) =>
    request('/admin/starting-balance', { method: 'POST', body: { amount }, adminPin }),

  createEvent: (payload, adminPin) =>
    request('/admin/events', { method: 'POST', body: payload, adminPin }),
  updateEventOdds: (id, outcomes, adminPin) =>
    request(`/admin/events/${id}/odds`, { method: 'PATCH', body: { outcomes }, adminPin }),
  updateEventDetails: (id, payload, adminPin) =>
    request(`/admin/events/${id}/details`, { method: 'PATCH', body: payload, adminPin }),
  lockEvent: (id, adminPin) => request(`/admin/events/${id}/lock`, { method: 'POST', adminPin }),
  reopenEvent: (id, adminPin) =>
    request(`/admin/events/${id}/reopen`, { method: 'POST', adminPin }),
  settleEvent: (id, winningOutcomeId, adminPin) =>
    request(`/admin/events/${id}/settle`, {
      method: 'POST',
      body: { winningOutcomeId },
      adminPin,
    }),
  undoSettle: (id, adminPin) =>
    request(`/admin/events/${id}/undo-settle`, { method: 'POST', adminPin }),
};
