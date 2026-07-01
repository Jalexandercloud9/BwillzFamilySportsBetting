import { state } from '../state.js';
import { formatMoney, escapeHtml } from '../format.js';

export function renderLeaderboard() {
  const ranked = [...state.players].sort((a, b) => b.balance - a.balance);
  const rows = ranked
    .map((p, i) => {
      const isMe = p.id === state.currentPlayerId;
      return `
        <div class="leader-row${isMe ? ' is-me' : ''}">
          <div class="leader-rank">#${i + 1}</div>
          <div class="leader-name">${escapeHtml(p.name)}${isMe ? ' (you)' : ''}</div>
          <div class="leader-balance">${formatMoney(p.balance)}</div>
        </div>
      `;
    })
    .join('');

  return `
    <h2 class="tab-title">Leaderboard</h2>
    ${rows || '<p class="empty-state">No players yet.</p>'}
  `;
}
