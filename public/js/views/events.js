import { state, currentPlayer } from '../state.js';
import { formatOdds, escapeHtml } from '../format.js';

function outcomeRow(event, outcome, { bettable }) {
  const player = currentPlayer();
  const oddsClass = outcome.odds < 0 ? 'outcome-odds negative' : 'outcome-odds';
  const isWinner = event.winningOutcomeId === outcome.id;
  const winnerClass = isWinner ? ' is-winner' : '';
  const betControls = bettable
    ? `
      <input
        class="wager-input"
        type="number"
        min="1"
        step="1"
        placeholder="$"
        data-wager-input
        data-event-id="${event.id}"
        data-outcome-id="${outcome.id}"
        ${player ? '' : 'disabled'}
      />
      <button
        class="bet-btn"
        data-action="place-bet"
        data-event-id="${event.id}"
        data-outcome-id="${outcome.id}"
        ${player ? '' : 'disabled'}
      >Bet</button>
    `
    : isWinner
      ? '<span class="winner-tag">Winner</span>'
      : '';

  return `
    <div class="outcome-row${winnerClass}">
      <div class="outcome-label">${escapeHtml(outcome.label)}</div>
      <div class="${oddsClass}">${formatOdds(outcome.odds)}</div>
      ${betControls}
    </div>
  `;
}

function eventCard(event, { bettable }) {
  const statusLabel = { open: 'Open', locked: 'Awaiting Result', settled: 'Settled' }[event.status];
  const rows = event.outcomes.map((o) => outcomeRow(event, o, { bettable })).join('');
  return `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(event.title)}</h3>
        <span class="status-badge status-${event.status}">${statusLabel}</span>
      </div>
      ${event.description ? `<p class="card-desc">${escapeHtml(event.description)}</p>` : ''}
      ${bettable ? '<p class="disclaimer">Payout uses odds at time of settlement, even if odds change after you bet.</p>' : ''}
      ${rows}
    </div>
  `;
}

export function renderEvents() {
  const open = state.events.filter((e) => e.status === 'open');
  const locked = state.events.filter((e) => e.status === 'locked');
  const settled = state.events
    .filter((e) => e.status === 'settled')
    .sort((a, b) => (b.settledAt || 0) - (a.settledAt || 0))
    .slice(0, 5);

  const sections = [];

  if (open.length) {
    sections.push(open.map((e) => eventCard(e, { bettable: true })).join(''));
  } else {
    sections.push('<p class="empty-state">No open events right now. Check back soon.</p>');
  }

  if (locked.length) {
    sections.push('<h3 class="tab-title" style="font-size:1rem;margin-top:22px;">Awaiting Result</h3>');
    sections.push(locked.map((e) => eventCard(e, { bettable: false })).join(''));
  }

  if (settled.length) {
    sections.push('<h3 class="tab-title" style="font-size:1rem;margin-top:22px;">Recently Settled</h3>');
    sections.push(settled.map((e) => eventCard(e, { bettable: false })).join(''));
  }

  return `<h2 class="tab-title">Events</h2>${sections.join('')}`;
}
