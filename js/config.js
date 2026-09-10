// ============================================================================
// ALLE BALANCING-ZAHLEN AN EINEM ORT.
// Die Werte in REQUIRED_EDGE_CP stammen aus echten Stockfish-18-Messungen
// (tools/balance.mjs). Zum Nachjustieren: dieses File, sonst nichts.
// ============================================================================

export const CONFIG = {
  START_MONEY: 55,
  START_HEARTS: 3,
  MAX_HEARTS: 5,
  START_FISH_LEVEL: 0,
  BASE_PLY_LIMIT: 44,           // Sockel; das echte Limit haengt an der Stellung
  MAX_PLY_LIMIT: 110,

  // Einkommen nach gewonnener Runde
  income: (round) => 13 + 3 * round,

  // Engine-Denkzeit pro Zug in ms (auch das Anschau-Tempo)
  MOVETIME_PLAYER: 120,
  MOVETIME_ENEMY: 120,

  // Shop
  fishUpgradeCost: (level) => 8 + level * 3,   // Lvl0->1 = 8$, Lvl10->11 = 38$
  HEART_COST: 30,
  PATIENCE_COST: 18,
  PATIENCE_GAIN: 8,
  DISCOUNT_COST: 24,
  MAX_DISCOUNT: 2,
  REROLL_COST: 4
};

// Das Zuglimit wird PRO STELLUNG berechnet, nicht global. Ein mieser Fisch
// gegen eine dicke Armee bekommt mehr Zeit -- sonst ist die fruehe Phase
// unfair, obwohl sie die leichteste sein soll.
export function plyLimitFor({ enemyMaterial, fishLevel, patienceBonus = 0 }) {
  const raw = CONFIG.BASE_PLY_LIMIT + enemyMaterial + (20 - fishLevel) * 1.6;
  return Math.min(CONFIG.MAX_PLY_LIMIT, Math.round(raw)) + patienceBonus;
}

// Wieviel Vorteil (in Centipawns) braucht dein Fisch, damit die Stellung
// realistisch gewinnbar ist? Gemessen: Skill 0 brauchte ~+25 Material,
// Skill 4-8 ~+8, Skill 12 ~+5, Skill 16-20 ~+3. 1 Bauer ~ 100cp.
const EDGE_TABLE = [
  [0, 2400], [2, 1500], [4, 900], [6, 800], [8, 750],
  [10, 600], [12, 500], [14, 420], [16, 340], [18, 300], [20, 260]
];

export function requiredEdgeCp(fishLevel) {
  let lo = EDGE_TABLE[0], hi = EDGE_TABLE[EDGE_TABLE.length - 1];
  for (let i = 0; i < EDGE_TABLE.length - 1; i++) {
    if (fishLevel >= EDGE_TABLE[i][0] && fishLevel <= EDGE_TABLE[i + 1][0]) {
      lo = EDGE_TABLE[i]; hi = EDGE_TABLE[i + 1]; break;
    }
  }
  if (hi[0] === lo[0]) return lo[1];
  const t = (fishLevel - lo[0]) / (hi[0] - lo[0]);
  return Math.round(lo[1] + t * (hi[1] - lo[1]));
}
