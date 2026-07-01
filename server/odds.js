// American odds math. Kept isolated and pure so it can be unit-tested
// independently of storage/HTTP concerns.

/**
 * @param {number} wager
 * @param {number} odds American odds, e.g. 150 or -200
 * @returns {number} profit only (not including returned wager)
 */
export function profitFor(wager, odds) {
  if (odds > 0) return wager * (odds / 100);
  return wager * (100 / Math.abs(odds));
}

/**
 * @param {number} wager
 * @param {number} odds American odds
 * @returns {number} total payout (wager + profit) for a winning bet
 */
export function payoutFor(wager, odds) {
  return wager + profitFor(wager, odds);
}
