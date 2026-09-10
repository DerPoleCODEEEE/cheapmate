// ============================================================================
// PERKS - the Black Market. Permanent, stacking, and deliberately unfair.
// A long run should end with you absurdly overpowered.
//
// Every perk declares WHERE it hooks in, so game.js stays readable:
//   price       : { type: -1 }      cheaper pieces
//   freeEach    : { p: 1 }          free placement credits every round
//   purse       : +N flat per win
//   refund      : fraction of your spend returned on a win
//   lootMult    : multiplies the loot payout
//   salvageRate : $ per material point of your surviving pieces (default .5)
//   thrift      : added to the thrift multiplier
//   speed       : added to the speed multiplier
//   skill       : { opening, lowPieces, boss }  engine skill bonuses
//   overtime    : win on timeout if you are ahead by this much (centipawns)
//   beachhead   : how many pieces may go on rank 4
//
// NOTE ON FREE PIECES: they are free in money but they still count as
// material, so they push your THRIFT multiplier down. You never have to
// place them. That is the point -- it is a real decision, not a freebie.
// ============================================================================

export const RARITY = {
  common:    { label: 'COMMON',    weight: 10 },
  rare:      { label: 'RARE',      weight: 5 },
  legendary: { label: 'LEGENDARY', weight: 2 }
};

export const PERKS = [
  // --- multipliers ---------------------------------------------------------
  { id: 'accountant', name: 'THE ACCOUNTANT', rarity: 'legendary', cost: 55, icon: 'coin',
    desc: '+0.25 to your THRIFT multiplier, always. The single best money perk.',
    effect: { thrift: 0.25 }, max: 2 },

  { id: 'headhunter', name: 'HEADHUNTER', rarity: 'rare', cost: 30, icon: 'skull',
    desc: 'Loot pays double. Every enemy piece you take is worth twice as much.',
    effect: { lootMult: 2 }, max: 2 },

  { id: 'undertaker', name: 'THE UNDERTAKER', rarity: 'rare', cost: 36, icon: 'coin',
    desc: 'Your surviving pieces refund their FULL value instead of half.',
    effect: { salvageRate: 1.0 }, max: 1 },

  { id: 'stopwatch', name: 'STOPWATCH', rarity: 'rare', cost: 32, icon: 'clock',
    desc: '+0.15 to your SPEED multiplier. Fast mates pay even better.',
    effect: { speed: 0.15 }, max: 2 },

  { id: 'dividends', name: 'DIVIDENDS', rarity: 'common', cost: 26, icon: 'coin',
    desc: '+$12 on the purse every win, before multipliers. Boring. Excellent.',
    effect: { purse: 12 }, max: 3 },

  { id: 'scavenger', name: 'SCAVENGER', rarity: 'rare', cost: 34, icon: 'coin',
    desc: 'Win and 40% of what you spent comes straight back.',
    effect: { refund: 0.4 }, max: 1 },

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

  // --- placement -----------------------------------------------------------
  { id: 'beachhead', name: 'BEACHHEAD', rarity: 'legendary', cost: 54, icon: 'flag',
    desc: 'You may place one piece on rank 4 - inside enemy territory.',
    effect: { beachhead: 1 }, max: 2 }
];

export const PERK_BY_ID = Object.fromEntries(PERKS.map(p => [p.id, p]));

// --- roll an offer ----------------------------------------------------------
export function rollOffer(owned, rand, count = 3) {
  const bag = [];
  for (const p of PERKS) {
    if ((owned[p.id] || 0) >= (p.max || 1)) continue;
    for (let i = 0; i < RARITY[p.rarity].weight; i++) bag.push(p);
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

// --- fold an inventory into one bonus object --------------------------------
export function totals(owned) {
  const t = {
    priceAll: 0, priceSet: {}, freeEach: {},
    purse: 0, refund: 0, lootMult: 1, salvageRate: null,
    thrift: 0, speed: 0,
    skillOpening: 0, openingPlies: 0, skillLowPieces: 0, skillBoss: 0,
    overtime: 0, beachhead: 0
  };
  for (const [id, n] of Object.entries(owned)) {
    const p = PERK_BY_ID[id];
    if (!p || !n) continue;
    const e = p.effect;
    if (e.priceAll) t.priceAll += e.priceAll * n;
    if (e.priceSet) for (const [k, v] of Object.entries(e.priceSet))
      t.priceSet[k] = Math.min(t.priceSet[k] == null ? Infinity : t.priceSet[k], v);
    if (e.freeEach) for (const [k, v] of Object.entries(e.freeEach))
      t.freeEach[k] = (t.freeEach[k] || 0) + v * n;
    if (e.purse) t.purse += e.purse * n;
    if (e.refund) t.refund = Math.max(t.refund, e.refund);
    if (e.lootMult) t.lootMult *= Math.pow(e.lootMult, n);
    if (e.salvageRate) t.salvageRate = Math.max(t.salvageRate || 0, e.salvageRate);
    if (e.thrift) t.thrift += e.thrift * n;
    if (e.speed) t.speed += e.speed * n;
    if (e.skill) {
      if (e.skill.opening) {
        t.skillOpening += e.skill.opening * n;
        t.openingPlies = Math.max(t.openingPlies, e.skill.openingPlies || 0);
      }
      if (e.skill.lowPieces) t.skillLowPieces += e.skill.lowPieces * n;
      if (e.skill.boss) t.skillBoss += e.skill.boss * n;
    }
    if (e.overtime) t.overtime = Math.max(t.overtime, e.overtime);
    if (e.beachhead) t.beachhead += e.beachhead * n;
  }
  return t;
}
