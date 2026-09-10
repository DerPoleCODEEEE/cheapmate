// ============================================================================
// EVERY BALANCING NUMBER LIVES HERE.
// The values below come from real Stockfish-vs-Stockfish measurements
// (tools/balance.mjs, tools/rampe.mjs, tools/overclock.mjs), not guesswork.
// ============================================================================

export const CONFIG = {
  START_MONEY: 55,
  START_HEARTS: 3,
  MAX_HEARTS: 6,
  START_FISH_LEVEL: 0,

  BASE_PLY_LIMIT: 44,
  MAX_PLY_LIMIT: 120,

  // Income after a won fight; bosses pay a lot more.
  income: (round) => 13 + 3 * round,
  bossBonus: (wave) => 30 + wave * 10,

  // Engine thinking time per move, in ms. Also the pace you watch at.
  BASE_MOVETIME: 120,
  MOVETIME_ENEMY: 120,
  MOVETIME_STEP: 70,          // per OVERCLOCK level
  MAX_OVERCLOCK: 5,

  // --- Lab (permanent stat upgrades) --------------------------------------
  fishUpgradeCost: (level) => 8 + level * 3,
  overclockCost: (n) => 14 + n * 12,
  patienceCost: (n) => 16 + n * 8,
  PATIENCE_GAIN: 8,
  heartCost: (owned) => 28 + owned * 14,

  // --- Black Market --------------------------------------------------------
  PERK_OFFERS: 3,
  rerollCost: (n) => 4 + n * 3,

  REFEREE_DEPTH: 10           // strength of the neutral evaluator for the bar
};

// More thinking time only helps a WEAK engine. Measured move-quality gain
// going from 120ms to 450ms: skill 2 = +105cp, skill 8 = +42cp,
// skill 14 = +14cp, skill 20 = -17cp (noise). The shop says so honestly.
export function overclockValueHint(fishLevel) {
  if (fishLevel <= 4)  return 'Huge right now.';
  if (fishLevel <= 9)  return 'Still worth it.';
  if (fishLevel <= 14) return 'Getting thin.';
  return 'Nearly pointless at this skill.';
}

export function movetimeFor(overclock) {
  return CONFIG.BASE_MOVETIME + overclock * CONFIG.MOVETIME_STEP;
}

// The half-move limit is computed PER POSITION, not globally: a bad fish
// facing a big army needs more time, or the early game is unfairly hard.
export function plyLimitFor({ enemyMaterial, fishLevel, patienceBonus = 0, bossDelta = 0 }) {
  const raw = CONFIG.BASE_PLY_LIMIT + enemyMaterial + (20 - fishLevel) * 1.6;
  return Math.max(24, Math.min(CONFIG.MAX_PLY_LIMIT, Math.round(raw)) + patienceBonus + bossDelta);
}

// How big an edge does this fish need to convert? Measured: skill 0 needed
// about +25 material, skill 4-8 about +8, skill 12+ about +3.
const EDGE_TABLE = [
  [0, 2400], [2, 1500], [4, 900], [6, 800], [8, 750],
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
