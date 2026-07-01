import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profitFor, payoutFor } from './odds.js';

test('+150: $100 wager wins $150 profit, $250 total payout', () => {
  assert.equal(profitFor(100, 150), 150);
  assert.equal(payoutFor(100, 150), 250);
});

test('-200: $200 wager wins $100 profit, $300 total payout', () => {
  assert.equal(profitFor(200, -200), 100);
  assert.equal(payoutFor(200, -200), 300);
});

test('+100 (even money): $50 wager wins $50 profit', () => {
  assert.equal(profitFor(50, 100), 50);
  assert.equal(payoutFor(50, 100), 100);
});

test('-110 (standard juice): $110 wager wins $100 profit', () => {
  assert.equal(profitFor(110, -110), 100);
  assert.equal(payoutFor(110, -110), 210);
});

test('fractional wager with positive odds', () => {
  assert.equal(profitFor(25, 300), 75);
  assert.equal(payoutFor(25, 300), 100);
});

test('fractional wager with negative odds', () => {
  assert.equal(profitFor(50, -400), 12.5);
  assert.equal(payoutFor(50, -400), 62.5);
});
