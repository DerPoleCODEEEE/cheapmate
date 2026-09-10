// ============================================================================
// EVERY BALANCING NUMBER LIVES HERE.
// The engine-related values come from real Stockfish-vs-Stockfish measurements
// (tools/balance.mjs, tools/rampe.mjs, tools/bosscheck.mjs), not guesswork.
// ============================================================================

export const CONFIG = {
  START_MONEY: 60,
  START_FISH_LEVEL: 0,

  BASE_PLY_LIMIT: 44,
  MAX_PLY_LIMIT: 120,

  // Engine thinking time per move, in ms. Also the pace you watch at.
  BASE_MOVETIME: 140,
  MOVETIME_ENEMY: 140,

  // --- Payout --------------------------------------------------------------
  // A win pays: (purse + loot + salvage) x thrift x speed.
  // The multipliers are the whole point, so the flat part stays small.
  purse: (round) => 12 + Math.round(2.5 * round),
  bossBonus: (wave) => 25 + wave * 8,
  LOOT_PER_POINT: 1.0,        // $ per material point you captured
  SALVAGE_PER_POINT: 0.5,     // $ per material point of yours still standing

  // --- The Lab (permanent stat upgrades) -----------------------------------
  fishUpgradeCost: (level) => 8 + level * 3,
  patienceCost: (n) => 16 + n * 8,
  PATIENCE_GAIN: 8,

  // --- The Black Market ----------------------------------------------------
  PERK_OFFERS: 3,
  rerollCost: (n) => 4 + n * 3,

  // MATE INSTINCT: however stupid your fish is, it never misses a forced mate.
  // A neutral full-strength search runs before each of your moves; if it sees
  // a mate, that move is played instead. Measured: depth 14 finds mate in 1-6
  // within milliseconds and still returns in well under 200ms on a full board
  // with no mate at all. (Stockfish's own `go mate N` is NOT usable here: with
  // no mate on the board it searches forever.)
  MATE_INSTINCT_DEPTH: 14
};

// ---------------------------------------------------------------------------
// THRIFT — the core multiplier. The less material you brought over White, the
// more a win pays. Winning with LESS material than White is the jackpot.
// Under permadeath this is a real gamble, which is why the placement screen
// shows the multiplier you are currently betting on.
// ---------------------------------------------------------------------------
export const THRIFT_TIERS = [
  { maxEdge: 0,        mult: 3.00, name: 'IMPOSSIBLE',  note: 'Less material than White. Absurd. Lucrative.' },
  { maxEdge: 3,        mult: 2.20, name: 'SHOESTRING',  note: 'Almost nothing to spare.' },
  { maxEdge: 7,        mult: 1.80, name: 'LEAN',        note: 'Tight, but sane.' },
  { maxEdge: 12,       mult: 1.45, name: 'SENSIBLE',    note: 'The honest middle.' },
  { maxEdge: 20,       mult: 1.15, name: 'COMFORTABLE', note: 'Safe. Pays badly.' },
  { maxEdge: Infinity, mult: 1.00, name: 'OVERKILL',    note: 'Lovely army. Terrible business.' }
];

export function thriftTier(edge) {
  return THRIFT_TIERS.find(t => edge <= t.maxEdge) || THRIFT_TIERS[THRIFT_TIERS.length - 1];
}

// ---------------------------------------------------------------------------
// SPEED — mate well inside the clock and the whole purse is worth more.
// ---------------------------------------------------------------------------
export const SPEED_TIERS = [
  { maxFrac: 0.35,     mult: 1.50, name: 'SURGICAL' },
  { maxFrac: 0.55,     mult: 1.25, name: 'BRISK' },
  { maxFrac: 0.80,     mult: 1.10, name: 'ON TIME' },
  { maxFrac: Infinity, mult: 1.00, name: 'SLOW' }
];

export function speedTier(plies, plyLimit) {
  const frac = plyLimit > 0 ? plies / plyLimit : 1;
  return SPEED_TIERS.find(t => frac <= t.maxFrac) || SPEED_TIERS[SPEED_TIERS.length - 1];
}

// The half-move limit is computed PER POSITION, not globally: a bad fish
// facing a big army needs more time, or the early game is unfairly hard.
export function plyLimitFor({ enemyMaterial, fishLevel, patienceBonus = 0, bossDelta = 0 }) {
  const raw = CONFIG.BASE_PLY_LIMIT + enemyMaterial + (20 - fishLevel) * 1.6;
  return Math.max(24, Math.min(CONFIG.MAX_PLY_LIMIT, Math.round(raw)) + patienceBonus + bossDelta);
}

// How big an edge does this fish need? Re-measured WITH mate instinct, which
// helps a stupid fish far more than a clever one -- a level-0 engine is
// exactly the one that used to walk past forced mates.
//   skill 0, enemy material 5, 3 seeds:  +6 -> 2/3   +12 -> 2/3   +20 -> 3/3
//   skill 4, enemy material 12, 4 seeds: +3 -> 1/4   +5  -> 2/4   +8  -> 3/4
//   skill 8, enemy material 12, 2 seeds: +5 -> 2/2   +9  -> 2/2
// The old table said skill 0 needed +24; with mate instinct that is roughly
// +13. Small samples, so the numbers are deliberately a little pessimistic.
const EDGE_TABLE = [
  [0, 1300], [2, 1100], [4, 900], [6, 800], [8, 750],
  [10, 600], [12, 500], [14, 420], [16, 340], [18, 300], [20, 260]
];

export function requiredEdgeCp(fishLevel) {
  const lvl = Math.max(0, Math.min(20, fishLevel));
  let lo = EDGE_TABLE[0], hi = EDGE_TABLE[EDGE_TABLE.length - 1];
  for (let i = 0; i < EDGE_TABLE.length - 1; i++) {
    if (lvl >= EDGE_TABLE[i][0] && lvl <= EDGE_TABLE[i + 1][0]) { lo = EDGE_TABLE[i]; hi = EDGE_TABLE[i + 1]; break; }
  }
  if (hi[0] === lo[0]) return lo[1];
  const t = (lvl - lo[0]) / (hi[0] - lo[0]);
  return Math.round(lo[1] + t * (hi[1] - lo[1]));
}

// Mate instinct means a forced mate is never missed, so the fish only has to
// be good enough to BUILD one. That is easier than converting unaided, hence
// the discount on the required edge.
// Measured win rate WITH mate instinct (skill 4, enemy material 12, 4 seeds):
//   edge +1 -> 0/4     edge +5 -> 2/4
//   edge +3 -> 1/4     edge +8 -> 3/4
// So the table above is about right and must NOT be discounted for mate
// instinct: at ratio 1.0 you are only a ~75-80% favourite, which under
// permadeath is a gamble. The advisor says so instead of pretending otherwise.
export const MATE_INSTINCT_DISCOUNT = 1.0;

// How the advisor talks about each risk band, calibrated against the numbers
// above. "Safe" only begins well past the required edge.
export const RISK_BANDS = [
  { max: 0.55, label: 'near-certain loss', tone: 'bad',
    text: 'Nowhere near enough material. This will end the run.' },
  { max: 0.90, label: 'serious gamble', tone: 'bad',
    text: 'Most builds this thin lose — and a loss ends the run.' },
  { max: 1.30, label: 'coin flip', tone: 'risky',
    text: 'Roughly even odds. Pays well if it lands, over if it does not.' },
  { max: 2.00, label: 'should hold', tone: 'good',
    text: 'Should hold up.' },
  { max: Infinity, label: 'very safe', tone: 'good',
    text: 'Very safe — and it pays like it.' }
];

export function riskBand(ratio) {
  return RISK_BANDS.find(b => ratio <= b.max) || RISK_BANDS[RISK_BANDS.length - 1];
}
