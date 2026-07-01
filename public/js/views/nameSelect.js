import { state } from '../state.js';
import { escapeHtml } from '../format.js';

export function renderNameSelect() {
  const buttons = state.players
    .map((p) => `<button class="name-btn" data-action="pick-player" data-id="${p.id}">${escapeHtml(p.name)}</button>`)
    .join('');

  return `
    <div class="screen">
      <h1>Who are you?</h1>
      <p class="subtitle">Pick your name to start betting.</p>
      <div class="name-grid">${buttons || '<p class="empty-state">No players yet. Ask the admin to add the roster.</p>'}</div>
      <button class="admin-link" data-action="open-admin-login">I'm the admin</button>
    </div>
  `;
}

export function renderAdminLoginModal(errorMsg) {
  return `
    <div class="modal-backdrop" data-action="close-modal-backdrop">
      <div class="modal" data-stop-propagation>
        <h3>Admin PIN</h3>
        ${errorMsg ? `<p class="error-msg">${escapeHtml(errorMsg)}</p>` : ''}
        <form data-form="admin-login">
          <input class="pin-input" type="password" inputmode="numeric" name="pin" placeholder="••••" autofocus />
          <div class="btn-row">
            <button type="button" class="btn btn-secondary" data-action="close-admin-login">Cancel</button>
            <button type="submit" class="btn btn-primary">Unlock</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
