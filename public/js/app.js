import { api } from './api.js';
import { state, setCurrentPlayer, setAdminPin, isAdmin, currentPlayer, applyServerState } from './state.js';
import { formatMoney } from './format.js';
import { icon } from './icons.js';
import { renderNameSelect, renderAdminLoginModal } from './views/nameSelect.js';
import { renderEvents } from './views/events.js';
import { renderMyBets } from './views/myBets.js';
import { renderLeaderboard } from './views/leaderboard.js';
import { renderAdmin, createEventDraft, resetCreateEventDraft, syncCreateDraftFromDom } from './views/admin.js';

const root = document.getElementById('app');

let showAdminLoginModal = false;
let adminLoginError = '';
let toastTimer = null;

// --- polling ----------------------------------------------------------------

async function refreshState() {
  try {
    const data = await api.getState();
    applyServerState(data);
  } catch (err) {
    console.error('Failed to refresh state', err);
  }
}

function isTypingInApp() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return root.contains(el) && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
}

async function poll() {
  await refreshState();
  if (!isTypingInApp()) {
    syncCreateDraftFromDom();
    render();
  }
}

setInterval(poll, 4000);

// --- toast --------------------------------------------------------------------

function showToast(message) {
  clearTimeout(toastTimer);
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  toastTimer = setTimeout(() => el.remove(), 3000);
}

// --- rendering ------------------------------------------------------------------

function renderTopbar() {
  const player = currentPlayer();
  const balancePill = player
    ? `<div class="balance-pill"><span class="label">Balance</span><span class="amount">${formatMoney(player.balance)}</span></div>`
    : isAdmin()
      ? '<div class="balance-pill"><span class="label">Mode</span><span class="amount">Admin</span></div>'
      : '';
  return `
    <div class="topbar">
      <div class="brand">Bwillz Family Sportsbook</div>
      ${balancePill}
    </div>
  `;
}

function renderTabbar() {
  const tabs = [
    ['events', 'trophy', 'Events'],
    ['mybets', 'ticket', 'My Bets'],
    ['leaderboard', 'bar-chart-2', 'Board'],
  ];
  if (isAdmin()) tabs.push(['admin', 'settings', 'Admin']);
  return `
    <div class="tabbar">
      <div class="tabbar-inner">
        ${tabs
          .map(
            ([key, iconName, label]) => `
              <button class="tab-btn${state.tab === key ? ' active' : ''}" data-action="switch-tab" data-tab="${key}">
                ${icon(iconName)}<span>${label}</span>
              </button>
            `
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderMain() {
  if (state.tab === 'mybets') return renderMyBets();
  if (state.tab === 'leaderboard') return renderLeaderboard();
  if (state.tab === 'admin' && isAdmin()) return renderAdmin();
  return renderEvents();
}

function renderFooterNote() {
  return `
    <p class="footer-note">
      ${!isAdmin() ? `<button class="admin-link" data-action="open-admin-login">${icon('lock')} Admin</button>` : ''}
      ${currentPlayer() ? `<button class="admin-link" data-action="switch-player">${icon('repeat')} Switch player</button>` : ''}
    </p>
  `;
}

export function render() {
  const needsNameSelect = !state.currentPlayerId && !isAdmin();

  if (needsNameSelect) {
    root.innerHTML = renderNameSelect() + (showAdminLoginModal ? renderAdminLoginModal(adminLoginError) : '');
    return;
  }

  root.innerHTML = `
    ${renderTopbar()}
    <main>${renderMain()}</main>
    ${renderFooterNote()}
    ${renderTabbar()}
    ${showAdminLoginModal ? renderAdminLoginModal(adminLoginError) : ''}
  `;
}

// --- actions --------------------------------------------------------------------

async function handlePlaceBet(button) {
  const eventId = button.dataset.eventId;
  const outcomeId = button.dataset.outcomeId;
  const input = document.querySelector(
    `[data-wager-input][data-event-id="${eventId}"][data-outcome-id="${outcomeId}"]`
  );
  const wager = Number(input?.value);
  const player = currentPlayer();
  if (!player) return showToast('Pick your name first.');
  if (!wager || wager <= 0) return showToast('Enter a wager amount.');
  if (wager > player.balance) return showToast("You can't bet more than your balance.");

  try {
    await api.placeBet({ playerId: player.id, eventId, outcomeId, wager });
    await refreshState();
    showToast('Bet placed!');
    render();
  } catch (err) {
    showToast(err.message);
  }
}

async function handleCreateEvent(form) {
  syncCreateDraftFromDom();
  const outcomes = createEventDraft.outcomes
    .filter((o) => o.label.trim())
    .map((o) => ({ label: o.label.trim(), odds: Number(o.odds) }));
  try {
    await api.createEvent(
      {
        title: createEventDraft.title,
        description: createEventDraft.description,
        outcomes,
        closeTime: createEventDraft.closeTime || null,
      },
      state.adminPin
    );
    resetCreateEventDraft();
    await refreshState();
    showToast('Event created.');
    render();
  } catch (err) {
    showToast(err.message);
  }
}

async function handleSaveOdds(button) {
  const eventId = button.dataset.eventId;
  const hasBets = button.dataset.hasBets === 'true';
  if (hasBets) {
    const ok = confirm(
      'This event already has bets. Changing odds will apply to ALL bets on that outcome (including ones placed earlier) at settlement time. Continue?'
    );
    if (!ok) return;
  }
  const container = document.querySelector(`[data-odds-form="${eventId}"]`);
  const inputs = [...container.querySelectorAll('[data-outcome-id]')];
  const outcomes = inputs.map((input) => ({
    id: input.dataset.outcomeId,
    label: input.closest('[data-odds-edit-row]').querySelector('input[disabled]').value,
    odds: Number(input.value),
  }));
  try {
    await api.updateEventOdds(eventId, outcomes, state.adminPin);
    await refreshState();
    showToast('Odds updated.');
    render();
  } catch (err) {
    showToast(err.message);
  }
}

async function handleSettle(button) {
  const eventId = button.dataset.eventId;
  const select = document.querySelector(`[data-settle-select="${eventId}"]`);
  const winningOutcomeId = select.value;
  const label = select.options[select.selectedIndex].text;
  const ok = confirm(`Settle this event with "${label}" as the winner? Payouts will be applied immediately.`);
  if (!ok) return;
  try {
    await api.settleEvent(eventId, winningOutcomeId, state.adminPin);
    await refreshState();
    showToast('Event settled.');
    render();
  } catch (err) {
    showToast(err.message);
  }
}

async function handleUndoSettle(button) {
  const eventId = button.dataset.eventId;
  const ok = confirm(
    'Undo this settlement? All payouts from it will be reversed and the event returns to Locked for re-settling.'
  );
  if (!ok) return;
  try {
    await api.undoSettle(eventId, state.adminPin);
    await refreshState();
    showToast('Settlement undone.');
    render();
  } catch (err) {
    showToast(err.message);
  }
}

async function handleRemovePlayer(button) {
  const playerId = button.dataset.playerId;
  const ok = confirm('Remove this player from the roster? Their past bets will remain in history.');
  if (!ok) return;
  try {
    await api.removeRosterPlayer(playerId, state.adminPin);
    await refreshState();
    render();
  } catch (err) {
    showToast(err.message);
  }
}

async function handleApplyStartingBalance(form) {
  const amount = Number(form.querySelector('[name="amount"]').value);
  const ok = confirm(`Set every player's balance to ${formatMoney(amount)}? This overwrites current balances.`);
  if (!ok) return;
  try {
    await api.setStartingBalanceForAll(amount, state.adminPin);
    await refreshState();
    showToast('Starting balance applied to all players.');
    render();
  } catch (err) {
    showToast(err.message);
  }
}

async function handleAdminLogin(form) {
  const pin = form.querySelector('[name="pin"]').value;
  try {
    await api.adminLogin(pin);
    setAdminPin(pin);
    showAdminLoginModal = false;
    adminLoginError = '';
    state.tab = 'admin';
    state.adminSubtab = 'create';
    await refreshState();
    render();
  } catch (err) {
    adminLoginError = err.message;
    render();
  }
}

// --- event delegation --------------------------------------------------------------

root.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  syncCreateDraftFromDom();

  if (action === 'pick-player') {
    setCurrentPlayer(el.dataset.id);
    state.tab = 'events';
    render();
  } else if (action === 'open-admin-login') {
    showAdminLoginModal = true;
    adminLoginError = '';
    render();
  } else if (action === 'close-admin-login' || action === 'close-modal-backdrop') {
    if (action === 'close-modal-backdrop' && e.target !== el) return;
    showAdminLoginModal = false;
    render();
  } else if (action === 'switch-tab') {
    state.tab = el.dataset.tab;
    render();
  } else if (action === 'admin-subtab') {
    state.adminSubtab = el.dataset.subtab;
    render();
  } else if (action === 'switch-player') {
    setCurrentPlayer(null);
    render();
  } else if (action === 'admin-logout') {
    setAdminPin(null);
    state.tab = 'events';
    render();
  } else if (action === 'place-bet') {
    await handlePlaceBet(el);
  } else if (action === 'add-outcome-row') {
    syncCreateDraftFromDom();
    createEventDraft.outcomes.push({ label: '', odds: '' });
    render();
  } else if (action === 'remove-outcome-row') {
    syncCreateDraftFromDom();
    createEventDraft.outcomes.splice(Number(el.dataset.index), 1);
    render();
  } else if (action === 'save-odds') {
    await handleSaveOdds(el);
  } else if (action === 'lock-event') {
    try {
      await api.lockEvent(el.dataset.eventId, state.adminPin);
      await refreshState();
      showToast('Event locked.');
      render();
    } catch (err) {
      showToast(err.message);
    }
  } else if (action === 'reopen-event') {
    try {
      await api.reopenEvent(el.dataset.eventId, state.adminPin);
      await refreshState();
      showToast('Event reopened.');
      render();
    } catch (err) {
      showToast(err.message);
    }
  } else if (action === 'settle-event') {
    await handleSettle(el);
  } else if (action === 'undo-settle') {
    await handleUndoSettle(el);
  } else if (action === 'remove-player') {
    await handleRemovePlayer(el);
  } else if (action === 'save-balance') {
    const input = document.querySelector(`[data-balance-input="${el.dataset.playerId}"]`);
    try {
      await api.setPlayerBalance(el.dataset.playerId, Number(input.value), state.adminPin);
      await refreshState();
      showToast('Balance updated.');
      render();
    } catch (err) {
      showToast(err.message);
    }
  }
});

root.addEventListener('submit', async (e) => {
  const form = e.target;
  e.preventDefault();
  if (form.dataset.form === 'admin-login') {
    await handleAdminLogin(form);
  } else if (form.dataset.form === 'create-event') {
    await handleCreateEvent(form);
  } else if (form.dataset.form === 'add-player') {
    const name = form.querySelector('[name="name"]').value;
    try {
      await api.addRosterPlayer(name, state.adminPin);
      await refreshState();
      showToast('Player added.');
      render();
    } catch (err) {
      showToast(err.message);
    }
  } else if (form.dataset.form === 'starting-balance') {
    await handleApplyStartingBalance(form);
  }
});

// --- boot -------------------------------------------------------------------------

async function boot() {
  await refreshState();
  render();
}

boot();
