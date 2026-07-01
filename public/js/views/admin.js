import { state } from '../state.js';
import { formatOdds, escapeHtml } from '../format.js';

export const createEventDraft = {
  title: '',
  description: '',
  closeTime: '',
  outcomes: [{ label: '', odds: '' }, { label: '', odds: '' }],
};

export function resetCreateEventDraft() {
  createEventDraft.title = '';
  createEventDraft.description = '';
  createEventDraft.closeTime = '';
  createEventDraft.outcomes = [{ label: '', odds: '' }, { label: '', odds: '' }];
}

export function syncCreateDraftFromDom() {
  const form = document.querySelector('[data-form="create-event"]');
  if (!form) return;
  createEventDraft.title = form.querySelector('[name="title"]')?.value ?? createEventDraft.title;
  createEventDraft.description =
    form.querySelector('[name="description"]')?.value ?? createEventDraft.description;
  createEventDraft.closeTime =
    form.querySelector('[name="closeTime"]')?.value ?? createEventDraft.closeTime;
  const rows = [...form.querySelectorAll('[data-outcome-edit-row]')];
  createEventDraft.outcomes = rows.map((row, i) => ({
    label: row.querySelector('[name="label"]')?.value ?? createEventDraft.outcomes[i]?.label ?? '',
    odds: row.querySelector('[name="odds"]')?.value ?? createEventDraft.outcomes[i]?.odds ?? '',
  }));
}

function renderSubtabs() {
  const tabs = [
    ['create', 'Create Event'],
    ['manage', 'Manage Events'],
    ['roster', 'Roster & Balances'],
  ];
  return `
    <div class="subtabs">
      ${tabs
        .map(
          ([key, label]) =>
            `<button class="subtab-btn${state.adminSubtab === key ? ' active' : ''}" data-action="admin-subtab" data-subtab="${key}">${label}</button>`
        )
        .join('')}
    </div>
  `;
}

function renderCreateEvent() {
  const outcomeRows = createEventDraft.outcomes
    .map(
      (o, i) => `
        <div class="outcome-edit-row" data-outcome-edit-row data-index="${i}">
          <input name="label" placeholder="Who / what (e.g. Dad)" value="${escapeHtml(o.label)}" />
          <input name="odds" type="number" placeholder="+150 or -200" value="${escapeHtml(o.odds)}" />
          <button type="button" class="icon-btn" data-action="remove-outcome-row" data-index="${i}" ${createEventDraft.outcomes.length <= 2 ? 'disabled' : ''}>✕</button>
        </div>
      `
    )
    .join('');

  return `
    ${renderSubtabs()}
    <div class="card">
      <form data-form="create-event">
        <div class="field">
          <label>Title</label>
          <input name="title" placeholder="Who wins closest to the pin on 3?" value="${escapeHtml(createEventDraft.title)}" required />
        </div>
        <div class="field">
          <label>Description (optional)</label>
          <textarea name="description">${escapeHtml(createEventDraft.description)}</textarea>
        </div>
        <div class="field">
          <label>Who could win, and their odds</label>
          <p class="disclaimer">
            One row per possible winner. The number on the right sets the payout: a
            <strong>positive</strong> number like <strong>+150</strong> is an underdog
            (bet $100 to win $150); a <strong>negative</strong> number like
            <strong>-200</strong> is a favorite (bet $200 to win $100). Use whole
            numbers like +150 or -200 &mdash; nothing between -99 and 99.
          </p>
          ${outcomeRows}
          <button type="button" class="btn btn-secondary btn-small" data-action="add-outcome-row">+ Add outcome</button>
        </div>
        <div class="field">
          <label>Close time (optional)</label>
          <input name="closeTime" type="datetime-local" value="${escapeHtml(createEventDraft.closeTime)}" />
        </div>
        <button type="submit" class="btn btn-primary">Create Event</button>
      </form>
    </div>
  `;
}

function manageOddsRow(event, outcome) {
  return `
    <div class="outcome-edit-row" data-odds-edit-row>
      <input name="label" value="${escapeHtml(outcome.label)}" disabled />
      <input name="odds-${outcome.id}" type="number" value="${outcome.odds}" data-outcome-id="${outcome.id}" />
    </div>
  `;
}

function manageEventCard(event) {
  const hasBets = state.bets.some((b) => b.eventId === event.id);
  const statusLabel = { open: 'Open', locked: 'Locked', settled: 'Settled' }[event.status];

  let body = '';
  if (event.status === 'open') {
    body = `
      <div data-odds-form="${event.id}">
        ${event.outcomes.map((o) => manageOddsRow(event, o)).join('')}
      </div>
      ${hasBets ? '<p class="disclaimer">This event already has bets. Changing odds applies to ALL bets on that outcome, at settlement time.</p>' : ''}
      <div class="btn-row">
        <button class="btn btn-secondary btn-small" data-action="save-odds" data-event-id="${event.id}" data-has-bets="${hasBets}">Save Odds</button>
        <button class="btn btn-primary btn-small" data-action="lock-event" data-event-id="${event.id}">Lock Event</button>
      </div>
    `;
  } else if (event.status === 'locked') {
    const options = event.outcomes
      .map((o) => `<option value="${o.id}">${escapeHtml(o.label)} (${formatOdds(o.odds)})</option>`)
      .join('');
    body = `
      <div class="field">
        <label>Winning outcome</label>
        <select data-settle-select="${event.id}">${options}</select>
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary btn-small" data-action="reopen-event" data-event-id="${event.id}">Reopen</button>
        <button class="btn btn-primary btn-small" data-action="settle-event" data-event-id="${event.id}">Settle</button>
      </div>
    `;
  } else {
    const winner = event.outcomes.find((o) => o.id === event.winningOutcomeId);
    body = `
      <p class="card-desc">Winner: <strong>${escapeHtml(winner?.label || '—')}</strong></p>
      <button class="btn btn-danger btn-small" data-action="undo-settle" data-event-id="${event.id}">Undo Settlement</button>
    `;
  }

  return `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(event.title)}</h3>
        <span class="status-badge status-${event.status}">${statusLabel}</span>
      </div>
      ${body}
    </div>
  `;
}

function renderManageEvents() {
  const sorted = [...state.events].sort((a, b) => b.createdAt - a.createdAt);
  return `
    ${renderSubtabs()}
    ${sorted.length ? sorted.map(manageEventCard).join('') : '<p class="empty-state">No events yet. Create one first.</p>'}
  `;
}

function rosterRow(player) {
  return `
    <div class="roster-row">
      <div class="roster-name">${escapeHtml(player.name)}${player.isAdmin ? ' ⭐' : ''}</div>
      <input type="number" data-balance-input="${player.id}" value="${player.balance}" />
      <button class="icon-btn" data-action="save-balance" data-player-id="${player.id}" title="Save">💾</button>
      <button class="icon-btn" data-action="remove-player" data-player-id="${player.id}" title="Remove">✕</button>
    </div>
  `;
}

function renderRoster() {
  return `
    ${renderSubtabs()}
    <div class="card">
      <h3 class="card-title" style="font-size:1rem;margin-bottom:8px;">Players</h3>
      ${state.players.map(rosterRow).join('') || '<p class="empty-state">No players yet.</p>'}
      <form class="field" style="margin-top:14px;" data-form="add-player">
        <label>Add player</label>
        <input name="name" placeholder="Family member name" required />
        <button type="submit" class="btn btn-primary btn-small" style="margin-top:8px;">Add Player</button>
      </form>
    </div>
    <div class="card">
      <h3 class="card-title" style="font-size:1rem;margin-bottom:8px;">Starting Balance</h3>
      <p class="card-desc">Applies to every player right now. Use this to reset for a new day/session.</p>
      <form class="field" data-form="starting-balance">
        <input name="amount" type="number" min="0" value="${state.startingBalance}" />
        <button type="submit" class="btn btn-secondary btn-small" style="margin-top:8px;">Apply to All Players</button>
      </form>
    </div>
    <div class="card">
      <button class="btn btn-secondary" data-action="admin-logout">Log Out of Admin</button>
    </div>
  `;
}

export function renderAdmin() {
  let body;
  if (state.adminSubtab === 'manage') body = renderManageEvents();
  else if (state.adminSubtab === 'roster') body = renderRoster();
  else body = renderCreateEvent();

  return `<h2 class="tab-title">Admin</h2>${body}`;
}
