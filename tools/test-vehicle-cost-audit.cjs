const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compareCosts, number } = require('./audit-vehicle-costs.cjs');
const wiki = overrides => ({ rp: 1000, sp: 2000, wiki: { research: '1,000', purchase: '2,000', purchase_currency: 'SL' }, ...overrides });

test('cost parsing preserves missing values and explicit free values', () => {
  assert.equal(number(null), null);
  assert.equal(number('Free'), 0);
  assert.equal(number('1,200,000'), 1200000);
  assert.equal(number('not available'), null);
});
test('equal standard costs produce no differences', () => {
  assert.deepEqual(compareCosts(wiki(), { reqExp: 1000, value: 2000 }, wiki()).issues, []);
});
test('local drift and source conflict are distinguished', () => {
  const result = compareCosts(wiki(), { reqExp: 500, value: 2000 }, wiki({ rp: 750 }));
  assert.equal(result.issues.filter(x => x.kind === 'local_wiki_difference').length, 1);
  assert.equal(result.issues.filter(x => x.kind === 'wiki_game_difference').length, 1);
});
test('premium internal research value never becomes ordinary RP', () => {
  const unit = wiki({ is_premium: true, rp: 0, sp: 0, wiki: { research: null, purchase: '9,270', purchase_currency: 'GE' } });
  const result = compareCosts(unit, { reqExp: 210000, value: 0 }, unit);
  assert.equal(result.excludedFromOrdinaryTotals, true);
  assert.deepEqual(result.issues, []);
});
test('squadron source costs are compared without re-enabling ordinary totals', () => {
  const unit = wiki({ is_squadron: true, rp: 0, sp: 0 });
  const result = compareCosts(unit, { reqExp: 1000, value: 2000 }, unit);
  assert.equal(result.excludedFromOrdinaryTotals, true);
  assert.deepEqual(result.issues, []);
});
test('reserve omission remains a documented omission, not invented game data', () => {
  const unit = wiki({ rp: 0, sp: 0, wiki: { research: 'Free', purchase: 'Free', purchase_currency: 'SL' } });
  const result = compareCosts(unit, { value: 0 }, unit);
  assert.equal(result.gameCosts.rp, null);
  assert.equal(result.issues[0].kind, 'free_vehicle_omitted_reqExp');
});
test('absent price cannot silently become zero', () => {
  const unit = wiki({ sp: null, wiki: { research: '1,000', purchase: null, purchase_currency: null } });
  const result = compareCosts(unit, { reqExp: 1000 }, unit);
  assert(result.issues.some(x => x.kind === 'wiki_missing_cost' && x.field === 'sl'));
  assert(result.issues.some(x => x.kind === 'game_missing_cost' && x.field === 'sl'));
});
