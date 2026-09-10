// ============================================================================
// PERKS - the Black Market. Permanent, stacking, and deliberately unfair.
// The whole point is that a long run should end with you absurdly overpowered.
//
// Every perk declares WHERE it hooks in, so game.js stays readable:
//   price       : { type: -1 }        cheaper pieces
//   freeEach    : { p: 1 }            free placement credits every round
//   income      : +N per won round
//   refund      : fraction of spend returned on a win
//   perCapture  : $ per piece your side takes
//   skill       : { flat, opening, lowPieces, boss }   engine skill bonuses
//   heartGuard  : first loss per wave costs no heart
//   healOnBoss  : heal 1 heart after a boss win
//   overtime    : win on timeout if you are winning by this much (centipawns)
//   beachhead   : how many pieces may go on the enemy half (rank 4)
// ============================================================================

export const RARITY = {
  common:    { label: 'COMMON',    weight: 10 },
  rare:      { label: 'RARE',      weight: 5 },
  legendary: { label: 'LEGENDARY', weight: 2 }
};

export const PERKS = [
  // --- money ---------------------------------------------------------------
  { id: 'bloodmoney', name: 'BLOOD MONEY', rarity: 'rare', cost: 30, icon: 'coin',
    desc: 'Every piece your side captures pays $2. Violence, monetised.',
    effect: { perCapture: 2 }, max: 3 },

  { id: 'scavenger', name: 'SCAVENGER', rarity: 'rare', cost: 34, icon: 'coin',
    desc: 'Win a fight and 40% of what you spent comes back.',
    effect: { refund: 0.4 }, max: 1 },

  { id: 'dividends', name: 'DIVIDENDS', rarity: 'common', cost: 26, icon: 'coin',
    desc: '+$12 every round you win. Boring. Excellent.',
    effect: { income: 12 }, max: 3 },

  // --- free pieces: the snowball ------------------------------------------
  { id: 'pawnfactory', name: 'PAWN FACTORY', rarity: 'common', cost: 24, icon: 'pawn',
    desc: 'A free pawn, every single round, forever.',
    effect: { freeEach: { p: 1 } }, max: 4 },

  { id: 'stable', name: 'THE STABLE', rarity: 'rare', cost: 42, icon: 'knight',
    desc: 'A free knight, every round. Your fish adores knights.',
    effect: { freeEach: { n: 1 } }, max: 2 },

  { id: 'chapel', name: 'THE CHAPEL', rarity: 'rare', cost: 42, icon: 'bishop',
    desc: 'A free bishop, every round. Long diagonals, zero dollars.',
    effect: { freeEach: { b: 1 } }, max: 2 },

  { id: 'armory', name: 'THE ARMORY', rarity: 'legendary', cost: 72, icon: 'rook',
    desc: 'A free rook. Every round. Yes, really.',
    effect: { freeEach: { r: 1 } }, max: 2 },

  { id: 'throneroom', name: 'THRONE ROOM', rarity: 'legendary', cost: 110, icon: 'queen',
    desc: 'A free queen every round. This is the run-winning one.',
    effect: { freeEach: { q: 1 } }, max: 1 },

  // --- discounts -----------------------------------------------------------
  { id: 'bargainbin', name: 'BARGAIN BIN', rarity: 'common', cost: 22, icon: 'tag',
    desc: 'Everything costs $1 less. Stacks.',
    effect: { priceAll: -1 }, max: 3 },

  { id: 'horsetrader', name: 'HORSE TRADER', rarity: 'common', cost: 20, icon: 'knight',
    desc: 'Knights cost $2 instead of $5.',
    effect: { priceSet: { n: 2 } }, max: 1 },

  { id: 'pawnshop', name: 'PAWN SHOP', rarity: 'common', cost: 18, icon: 'pawn',
    desc: 'Pawns cost $1.',
    effect: { priceSet: { p: 1 } }, max: 1 },

  // --- engine --------------------------------------------------------------
  { id: 'adrenaline', name: 'ADRENALINE', rarity: 'rare', cost: 36, icon: 'bolt',
    desc: '+4 skill for the first 12 half-moves. Your fish starts hot.',
    effect: { skill: { opening: 4, openingPlies: 12 } }, max: 2 },

  { id: 'clutch', name: 'CLUTCH', rarity: 'rare', cost: 38, icon: 'bolt',
    desc: '+5 skill once you are down to three pieces or fewer.',
    effect: { skill: { lowPieces: 5 } }, max: 2 },

  { id: 'giantslayer', name: 'GIANT SLAYER', rarity: 'legendary', cost: 60, icon: 'skull',
    desc: '+3 skill during boss fights. PRIME will not enjoy this.',
    effect: { skill: { boss: 3 } }, max: 2 },

  { id: 'overtime', name: 'OVERTIME', rarity: 'legendary', cost: 66, icon: 'clock',
    desc: 'Out of moves but winning by six or more? You win anyway.',
    effect: { overtime: 600 }, max: 1 },

  // --- defence -------------------------------------------------------------
  { id: 'insurance', name: 'INSURANCE', rarity: 'rare', cost: 40, icon: 'heart',
    desc: 'The first loss in each wave costs you no heart.',
    effect: { heartGuard: true }, max: 1 },

  { id: 'secondwind', name: 'SECOND WIND', rarity: 'rare', cost: 46, icon: 'heart',
    desc: 'Beat a boss, get a heart back.',
    effect: { healOnBoss: 1 }, max: 1 },

  // --- placement -----------------------------------------------------------
  { id: 'beachhead', name: 'BEACHHEAD', rarity: 'legendary', cost: 54, icon: 'flag',
    desc: 'You may place one piece on rank 4 - inside enemy territory.',
    effect: { beachhead: 1 }, max: 2 }
];

export const PERK_BY_ID = Object.fromEntries(PERKS.map(p => [p.id, p]));

// --- Angebot wuerfeln -------------------------------------------------------
export function rollOffer(owned, rand, count = 3) {
  const bag = [];
  for (const p of PERKS) {
    const have = owned[p.id] || 0;
    if (have >= (p.max || 1)) continue;
    const w = RARITY[p.rarity].weight;
    for (let i = 0; i < w; i++) bag.push(p);
  }
  const out = [];
  const used = new Set();
  let guard = 0;
  while (out.length < count && bag.length && guard++ < 300) {
    const p = bag[Math.floor(rand() * bag.length)];
    if (used.has(p.id)) continue;
    used.add(p.id);
    out.push(p);
  }
  return out;
}

// --- Alle Effekte eines Inventars zu einem Bonus-Objekt zusammenrechnen -----
export function totals(owned) {
  const t = {
    priceAll: 0, priceSet: {}, freeEach: {}, income: 0, refund: 0, perCapture: 0,
    skillOpening: 0, openingPlies: 0, skillLowPieces: 0, skillBoss: 0,
    heartGuard: false, healOnBoss: 0, overtime: 0, beachhead: 0
  };
  for (const [id, n] of Object.entries(owned)) {
    const p = PERK_BY_ID[id];
    if (!p || !n) continue;
    const e = p.effect;
    if (e.priceAll) t.priceAll += e.priceAll * n;
    if (e.priceSet) for (const [k, v] of Object.entries(e.priceSet))
      t.priceSet[k] = Math.min(t.priceSet[k] ?? Infinity, v);
    if (e.freeEach) for (const [k, v] of Object.entries(e.freeEach))
      t.freeEach[k] = (t.freeEach[k] || 0) + v * n;
    if (e.income) t.income += e.income * n;
    if (e.refund) t.refund = Math.max(t.refund, e.refund);
    if (e.perCapture) t.perCapture += e.perCapture * n;
    if (e.skill) {
      if (e.skill.opening) { t.skillOpening += e.skill.opening * n; t.openingPlies = Math.max(t.openingPlies, e.skill.openingPlies || 0); }
      if (e.skill.lowPieces) t.skillLowPieces += e.skill.lowPieces * n;
      if (e.skill.boss) t.skillBoss += e.skill.boss * n;
    }
    if (e.heartGuard) t.heartGuard = true;
    if (e.healOnBoss) t.healOnBoss += e.healOnBoss * n;
    if (e.overtime) t.overtime = Math.max(t.overtime, e.overtime);
    if (e.beachhead) t.beachhead += e.beachhead * n;
  }
  return t;
}
