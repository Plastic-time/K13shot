const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const planner = require('../docs/planner.js');

const root = path.resolve(__dirname, '..');
const unlockSource = fs.readFileSync(path.join(root, 'docs', 'unlock-quantity.js'), 'utf8') + '\nthis.table = unlock_quantity;';
const unlockContext = {};
vm.runInNewContext(unlockSource, unlockContext);

function number(value) {
  if (typeof value === 'number') return value;
  if (value == null) return 0;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function squadron(item) {
  const className = String(item?.class_name || '').trim().toLowerCase();
  return item?.is_squadron === true || item?.isSquadron === true || className === 'squad';
}

function flatten(tree) {
  const units = [];
  const groups = [];
  const previous = { researchable: [], premium: [] };
  tree.forEach((rank, rankIndex) => {
    if (rankIndex === 1) previous.researchable = [];
    for (const field of ['researchable_vehicles', 'premium_vehicles']) {
      const section = field === 'researchable_vehicles' ? 'researchable' : 'premium';
      (rank[field] || []).forEach((column, columnIndex) => {
        let prior = previous[section][columnIndex] || '';
        column.forEach((item, rowIndex) => {
          const inferred = section === 'researchable' ? prior : '';
          if (item.type === 'multiple') {
            const required = item.required_unit_id || inferred;
            const isSquadron = squadron(item);
            groups.push({ ...item, required_unit_id: required, rank: rank.rank, section, columnIndex, rowIndex });
            (item.items || []).forEach((child, childIndex) => units.push({
              ...child,
              class_name: child.class_name || (isSquadron ? 'squad' : ''),
              is_squadron: isSquadron || child.is_squadron === true,
              required_unit_id: child.required_unit_id || required,
              parent_required_unit_id: required,
              parent_group_id: item.data_unit_id,
              rank: rank.rank,
              section,
              columnIndex,
              rowIndex: rowIndex + childIndex / 10,
            }));
            if (section === 'researchable') {
              prior = (item.items || []).map(child => child.data_unit_id).find(Boolean) || item.data_unit_id || prior;
              previous[section][columnIndex] = prior;
            }
          } else {
            const isSquadron = squadron(item);
            units.push({ ...item, is_squadron: isSquadron, required_unit_id: item.required_unit_id || inferred,
              rank: rank.rank, section, columnIndex, rowIndex });
            if (section === 'researchable') {
              prior = item.data_unit_id || prior;
              previous[section][columnIndex] = prior;
            }
          }
        });
      });
    }
  });
  return { units, groups };
}

function isInitial(unit) {
  const special = ['prem', 'premium', 'squad', 'event', 'gift'];
  return unit.section === 'researchable' && planner.rankOrder(unit.rank) === 1 &&
    !special.includes(String(unit.class_name || '').toLowerCase()) && unit.rp != null && unit.sp != null &&
    number(unit.rp) === 0 && number(unit.sp) === 0;
}

function makeInput(country, type, targetIds, extra = {}) {
  const tree = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'database', country, `${country}_${type}.json`), 'utf8'));
  const { units, groups } = flatten(tree);
  const roster = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'roster-audit.json'), 'utf8'));
  const rosterUnits = roster.trees[`${country}/${type}`]?.units || {};
  return {
    units,
    groups,
    ranks: tree.map(rank => ({ rank: rank.rank, unlockQuantity: number(rank.unlock_quantity) || number(unlockContext.table[country]?.[type]?.[rank.rank]) })),
    initialIds: units.filter(isInitial).map(unit => unit.data_unit_id),
    hiddenIds: Object.entries(rosterUnits).filter(([, item]) => item.hidden).map(([id]) => id),
    targetIds,
    ownedIds: [],
    waypointIds: [],
    timeLimitMs: 5000,
    maxStates: 300000,
    ...extra,
  };
}

const input = makeInput('usa', 'ground', ['us_m18_hellcat']);
const first = planner.plan(input);
const second = planner.plan(input);
assert(first.feasible, JSON.stringify(first));
assert(first.searchComplete, `M18 planning should complete exactly: ${JSON.stringify(first)}`);
assert(first.selectedIds.includes('us_m18_hellcat'));
assert(first.rankCounts.every(rank => rank.selected >= rank.required), JSON.stringify(first.rankCounts));
assert.deepEqual(first.selectedIds, second.selectedIds, 'Exact planner must be deterministic');
assert.equal(first.totalRp, second.totalRp);

const unitMap = new Map(input.units.map(unit => [unit.data_unit_id, unit]));
assert(first.fillerIds.every(id => unitMap.get(id)?.section === 'researchable'));
assert(first.fillerIds.every(id => !input.hiddenIds.includes(id)), 'Hidden vehicles cannot be automatic fillers');

const folded = planner.plan(makeInput('usa', 'ground', ['us_m18_hellcat'], { avoidFolded: true }));
assert(folded.feasible, JSON.stringify(folded));
assert(folded.fillerIds.every(id => !unitMap.get(id)?.parent_group_id), 'Folded vehicles cannot be optional fillers');

const waypointId = input.units.find(unit => planner.rankOrder(unit.rank) === 2 && unit.section === 'researchable')?.data_unit_id;
const withWaypoint = planner.plan({ ...input, waypointIds: [waypointId] });
assert(withWaypoint.selectedIds.includes(waypointId));
assert(withWaypoint.totalRp >= first.totalRp || withWaypoint.selectedIds.length >= first.selectedIds.length);

const premium = input.units.find(unit => unit.section === 'premium' && planner.rankOrder(unit.rank) === 2);
assert(premium, 'Expected a USA Rank II premium vehicle');
const withOwnedPremium = planner.plan({ ...input, ownedIds: [premium.data_unit_id] });
assert(withOwnedPremium.rankCounts.find(rank => rank.rank === 2).selected >= first.rankCounts.find(rank => rank.rank === 2).selected);
assert(!withOwnedPremium.selectedIds.includes(premium.data_unit_id));

console.log(JSON.stringify({
  target: 'us_m18_hellcat',
  rp: first.totalRp,
  sl: first.totalSp,
  selected: first.selectedIds.length,
  fillers: first.fillerIds.length,
  ranks: first.rankCounts,
  states: first.exploredStates,
  elapsedMs: first.elapsedMs,
  foldedRp: folded.totalRp,
  ownedPremiumRp: withOwnedPremium.totalRp,
}, null, 2));
