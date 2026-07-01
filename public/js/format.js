export function formatOdds(odds) {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function formatMoney(amount) {
  const n = Number(amount) || 0;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}
