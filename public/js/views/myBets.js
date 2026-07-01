import { state } from '../state.js';
import { formatOdds, formatMoney, escapeHtml } from '../format.js';

function eventFor(eventId) {
  return state.events.find((e) => e.id === eventId);
}

function outcomeLabel(event, outcomeId) {
  return event?.outcomes.find((o) => o.id === outcomeId)?.label || 'Unknown';
}

function betRow(bet) {
  const event = eventFor(bet.eventId);
  const outcomeName = outcomeLabel(event, bet.outcomeId);
  const eventTitle = event ? event.title : 'Unknown event';

  let resultClass = 'pending';
  let resultText = 'Pending';
  if (bet.status === 'won') {
    resultClass = 'win';
    resultText = `+${formatMoney(bet.payout)}`;
  } else if (bet.status === 'lost') {
    resultClass = 'loss';
    resultText = `-${formatMoney(bet.wager)}`;
  }

  return `
    <div class="bet-item">
      <div class="bet-meta">
        <div class="bet-event">${escapeHtml(eventTitle)}</div>
        <div class="bet-sub">${escapeHtml(outcomeName)} · ${formatOdds(bet.oddsAtBetTime)} · wagered ${formatMoney(bet.wager)}</div>
      </div>
      <div class="bet-result ${resultClass}">${resultText}</div>
    </div>
  `;
}

export function renderMyBets() {
  if (!state.currentPlayerId) {
    return '<h2 class="tab-title">My Bets</h2><p class="empty-state">Pick your name from the home screen to see your bets.</p>';
  }
  const mine = state.bets.filter((b) => b.playerId === state.currentPlayerId);
  const pending = mine.filter((b) => b.status === 'pending');
  const settled = mine
    .filter((b) => b.status !== 'pending')
    .sort((a, b) => (b.placedAt || 0) - (a.placedAt || 0));

  const sections = [];
  sections.push('<h3 class="tab-title" style="font-size:1rem;">Pending</h3>');
  sections.push(
    pending.length
      ? `<div class="card">${pending.map(betRow).join('')}</div>`
      : '<p class="empty-state">No pending bets.</p>'
  );
  sections.push('<h3 class="tab-title" style="font-size:1rem;margin-top:22px;">History</h3>');
  sections.push(
    settled.length
      ? `<div class="card">${settled.map(betRow).join('')}</div>`
      : '<p class="empty-state">No settled bets yet.</p>'
  );

  return `<h2 class="tab-title">My Bets</h2>${sections.join('')}`;
}
