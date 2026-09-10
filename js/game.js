// ============================================================================
// Run state, economy, waves, bosses, perks. No DOM in here, so it all stays
// testable from Node.
//
// PERMADEATH: one lost fight ends the run. There are no lives. Everything the
// placement screen shows -- verdict, thrift tier, mate-in-one warning -- exists
// because of that: you never make a move, so you must be able to judge the bet
// before you take it.
// ============================================================================
import { CONFIG, plyLimitFor, requiredEdgeCp, thriftTier, speedTier,
         MATE_INSTINCT_DISCOUNT } from './config.js';
import {
  COST, VALUE, PLAYER_KING_SQUARE, PLAYER_COLOR, ENEMY_COLOR, PLAYER_ZONE,
  isLegalPlacement, buildFen, FILES, countTypes, armyLegalityProblem
} from './rules.js';
import { generateEnemy } from './generator.js';
import { validateSetup } from './validate.js';
import { scheduleFor, bossForWave, RANK_TAUNTS } from './content.js';
import { PERK_BY_ID, rollOffer, totals } from './perks.js';
import { Chess } from '../vendor/chess.js';

export const PHASE = { BOOT: 'boot', PLACE: 'place', SIM: 'sim', RESULT: 'result', SHOP: 'shop', OVER: 'over', WON: 'won' };

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Game {
  constructor(seed = Math.floor(Math.random() * 1e9)) {
    this.seed = seed;
    this.reset();
  }

  reset() {
    this.round = 0;
    this.wave = 1;
    this.money = CONFIG.START_MONEY;
    this.fishLevel = CONFIG.START_FISH_LEVEL;
    this.patience = 0;
    this.perks = {};                 // id -> count
    this.phase = PHASE.BOOT;
    this.enemy = null;
    this.boss = null;
    this.isBoss = false;
    this.slot = 1;
    this.placed = [];
    this.freeCredits = {};
    this.spentThisRound = 0;
    this.roundBudget = 0;
    this.plyLimit = 60;
    this.startEdge = 0;
    this.lastResult = null;
    this.history = [];
    this.totalEarned = 0;
    this.rerolls = 0;
    this.offer = [];
    this.rand = mulberry(this.seed ^ 0x9e3779b9);
  }

  // --- perk helpers --------------------------------------------------------
  get bonus() { return totals(this.perks); }
  perkCount(id) { return this.perks[id] || 0; }
  get movetime() { return CONFIG.BASE_MOVETIME; }

  // --- prices --------------------------------------------------------------
  priceOf(type) {
    if ((this.freeCredits[type] || 0) > 0) return 0;
    const b = this.bonus;
    const base = b.priceSet[type] != null ? b.priceSet[type] : COST[type];
    return Math.max(1, base + b.priceAll);
  }

  placementMinRank() { return this.bonus.beachhead > 0 ? 4 : PLAYER_ZONE[0]; }
  beachheadUsed() { return this.placed.filter(p => +p.square[1] === 4).length; }

  // --- starting a fight ----------------------------------------------------
  startRound() {
    this.round++;
    const sched = scheduleFor(this.round);
    this.wave = sched.wave;
    this.isBoss = sched.isBoss;
    this.slot = sched.slot;

    if (this.isBoss) {
      const boss = bossForWave(sched.wave);
      this.boss = boss;
      this.enemy = {
        theme: { id: boss.id, name: boss.name, blurb: boss.title },
        pieces: boss.pieces.map(p => ({ ...p, color: ENEMY_COLOR })),
        material: boss.pieces.reduce((s, p) => s + (VALUE[p.type] || 0), 0),
        round: this.round, boss: true
      };
    } else {
      this.boss = null;
      this.enemy = generateEnemy(this.round, this.seed);
      this.enemy.theme.blurb = this.enemy.theme.blurb ||
        RANK_TAUNTS[this.round % RANK_TAUNTS.length];
    }

    const mods = (this.boss && this.boss.mods) || {};
    this.roundBudget = mods.budget || 0;
    this.money += this.roundBudget;

    this.placed = [];
    this.spentThisRound = 0;
    this.phase = PHASE.PLACE;

    this.freeCredits = {};
    for (const [t, n] of Object.entries(this.bonus.freeEach)) this.freeCredits[t] = n;

    this.plyLimit = plyLimitFor({
      enemyMaterial: this.enemy.material,
      fishLevel: this.fishLevel,
      patienceBonus: this.patience,
      bossDelta: mods.ply || 0
    });
    return this.enemy;
  }

  // --- placement -----------------------------------------------------------
  playerPieces() {
    return [{ type: 'k', color: PLAYER_COLOR, square: PLAYER_KING_SQUARE }, ...this.placed];
  }
  occupied() {
    const s = new Set([PLAYER_KING_SQUARE]);
    for (const p of this.placed) s.add(p.square);
    for (const p of this.enemy.pieces) s.add(p.square);
    return s;
  }

  // Squares where dropping this piece would leave White with zero legal moves,
  // i.e. mate or stalemate before White has moved once. Threatening mate is
  // fine and encouraged; finishing it without a reply is not.
  forbiddenSquares(type) {
    const set = new Set();
    if (!type || !this.enemy) return set;
    const c = new Chess();
    try { c.load(buildFen([...this.enemy.pieces, ...this.playerPieces()], 'w'), { skipValidation: true }); }
    catch (e) { return set; }
    const occ = this.occupied();
    for (let rank = this.placementMinRank(); rank <= 8; rank++) {
      for (const f of FILES) {
        const sq = f + rank;
        if (occ.has(sq)) continue;
        if (type === 'p' && rank === 8) continue;
        c.put({ type, color: PLAYER_COLOR }, sq);
        if (c.moves().length === 0) set.add(sq);
        c.remove(sq);
      }
    }
    return set;
  }

  buy(type, square) {
    const rank = +square[1];
    const minRank = this.placementMinRank();
    if (rank === 4 && this.bonus.beachhead > 0 && this.beachheadUsed() >= this.bonus.beachhead)
      return { ok: false, msg: `Beachhead allows ${this.bonus.beachhead} piece(s) on rank 4. That slot is used.` };
    if (rank < minRank || rank > 8)
      return { ok: false, msg: `You can only build on your own half (rank ${minRank}-8).` };
    if (!isLegalPlacement(square, type, minRank))
      return { ok: false, msg: 'Pawns cannot stand on rank 8.' };
    if (this.occupied().has(square)) return { ok: false, msg: 'Something is already there.' };
    if (this.forbiddenSquares(type).has(square))
      return { ok: false, msg: 'That would mate or stalemate White instantly. White needs at least one move.' };

    // Stockfish refuses to evaluate impossible armies -- catch it before it happens.
    const after = countTypes(this.placed);
    after[type] = (after[type] || 0) + 1;
    const problem = armyLegalityProblem(after);
    if (problem) return { ok: false, msg: problem };

    const free = (this.freeCredits[type] || 0) > 0;
    const price = this.priceOf(type);
    if (!free && this.money < price) return { ok: false, msg: 'Not enough money.' };

    if (free) this.freeCredits[type]--;
    else { this.money -= price; this.spentThisRound += price; }
    this.placed.push({ type, color: PLAYER_COLOR, square, free });
    return { ok: true, price, free };
  }

  sell(square) {
    const i = this.placed.findIndex(p => p.square === square);
    if (i < 0) return { ok: false };
    const p = this.placed[i];
    this.placed.splice(i, 1);
    if (p.free) {
      this.freeCredits[p.type] = (this.freeCredits[p.type] || 0) + 1;
      return { ok: true, refund: 0, free: true, type: p.type };
    }
    const b = this.bonus;
    const refund = Math.max(1, (b.priceSet[p.type] != null ? b.priceSet[p.type] : COST[p.type]) + b.priceAll);
    this.money += refund;
    this.spentThisRound -= refund;
    return { ok: true, refund, type: p.type };
  }

  clearBoard() { while (this.placed.length) this.sell(this.placed[0].square); }

  // For the UI: is this piece type still buyable at all?
  typeBlocked(type) {
    const after = countTypes(this.placed);
    after[type] = (after[type] || 0) + 1;
    return armyLegalityProblem(after);
  }

  validate() { return validateSetup(this.enemy.pieces, this.playerPieces()); }

  materialEdge() {
    const mine = this.placed.reduce((s, p) => s + (VALUE[p.type] || 0), 0);
    return mine - this.enemy.material;
  }
  myMaterial() { return this.placed.reduce((s, p) => s + (VALUE[p.type] || 0), 0); }

  // Mate instinct means a forced mate is never missed, so the fish only has to
  // build one, not find it. That lowers the material it needs.
  requiredEdge() { return requiredEdgeCp(this.fishLevel) * MATE_INSTINCT_DISCOUNT; }

  // --- multipliers ---------------------------------------------------------
  // Shown live during placement so the bet is visible before you take it.
  thriftNow() {
    const b = this.bonus;
    const tier = thriftTier(this.materialEdge());
    return { ...tier, mult: +(tier.mult + b.thrift).toFixed(2) };
  }
  speedBest() {
    const b = this.bonus;
    const tier = SPEED_BEST;
    return { ...tier, mult: +(tier.mult + b.speed).toFixed(2) };
  }

  // A rough "if you win right now" figure for the placement screen.
  previewPayout() {
    const b = this.bonus;
    const thrift = this.thriftNow();
    const purse = CONFIG.purse(this.round) + b.purse +
      (this.isBoss ? CONFIG.bossBonus(this.wave) : 0);
    // Assume you keep about two thirds of your material and take about half
    // of White's -- close enough for a preview, and honest about being one.
    const salvage = Math.round(this.myMaterial() * 0.66 * (b.salvageRate ?? CONFIG.SALVAGE_PER_POINT));
    const loot = Math.round(this.enemy.material * 0.5 * CONFIG.LOOT_PER_POINT * b.lootMult);
    const low = Math.round((purse + salvage + loot) * thrift.mult * (1 + b.speed));
    const high = Math.round((purse + salvage + loot) * thrift.mult * (1.5 + b.speed));
    return { thrift, low, high, purse, salvage, loot };
  }

  // --- THE MIRROR copies your most expensive purchase onto White's side ----
  applyMirror() {
    if (!this.boss || !this.boss.mods.mirror || !this.placed.length) return null;
    const best = [...this.placed].sort((a, b) => VALUE[b.type] - VALUE[a.type])[0];
    const c = new Chess();
    try { c.load(buildFen([...this.enemy.pieces, ...this.playerPieces()], 'w'), { skipValidation: true }); }
    catch (e) { return null; }
    const occ = this.occupied();
    for (let rank = 3; rank >= 1; rank--) {
      for (const f of FILES) {
        const sq = f + rank;
        if (occ.has(sq)) continue;
        if (best.type === 'p' && rank === 1) continue;
        c.put({ type: best.type, color: ENEMY_COLOR }, sq);
        const bad = c.isAttacked(PLAYER_KING_SQUARE, ENEMY_COLOR) || c.moves().length === 0;
        c.remove(sq);
        if (bad) continue;
        const copy = { type: best.type, color: ENEMY_COLOR, square: sq, mirrored: true };
        this.enemy.pieces.push(copy);
        this.enemy.material += VALUE[best.type];
        return copy;
      }
    }
    return null;
  }

  // Called the moment the fight actually starts, after any mirror copy, so the
  // thrift tier is judged on the position that was really played.
  lockInEdge() { this.startEdge = this.materialEdge(); return this.startEdge; }

  // --- engine strength during a fight -------------------------------------
  effectiveSkill({ ply = 0, myPieces = 99 } = {}) {
    const b = this.bonus;
    let s = this.fishLevel;
    if (this.boss && this.boss.mods.fish) s += this.boss.mods.fish;
    if (b.skillOpening && ply < b.openingPlies) s += b.skillOpening;
    if (b.skillLowPieces && myPieces <= 3) s += b.skillLowPieces;
    if (b.skillBoss && this.isBoss) s += b.skillBoss;
    return Math.max(0, Math.min(20, Math.round(s)));
  }

  // --- payout --------------------------------------------------------------
  // Returns a full breakdown so the result screen can count it up line by line.
  computePayout({ plies, capturedValue, survivingValue }) {
    const b = this.bonus;
    const thrift = thriftTier(this.startEdge);
    const speed = speedTier(plies, this.plyLimit);
    const thriftMult = +(thrift.mult + b.thrift).toFixed(2);
    const speedMult = +(speed.mult + b.speed).toFixed(2);

    const basePurse = CONFIG.purse(this.round) + b.purse;
    const bossPurse = this.isBoss ? CONFIG.bossBonus(this.wave) : 0;
    const loot = Math.round(capturedValue * CONFIG.LOOT_PER_POINT * b.lootMult);
    const salvage = Math.round(survivingValue * (b.salvageRate ?? CONFIG.SALVAGE_PER_POINT));
    const refund = Math.round(Math.max(0, this.spentThisRound) * b.refund);

    const subtotal = basePurse + bossPurse + loot + salvage;
    const afterMults = Math.round(subtotal * thriftMult * speedMult);
    const total = afterMults + refund;

    const lines = [
      { key: 'purse', label: 'Purse', value: basePurse },
      ...(bossPurse ? [{ key: 'boss', label: 'Boss bounty', value: bossPurse }] : []),
      ...(loot ? [{ key: 'loot', label: `Loot (${capturedValue} pts taken)`, value: loot }] : []),
      ...(salvage ? [{ key: 'salvage', label: `Salvage (${survivingValue} pts survived)`, value: salvage }] : [])
    ];
    const mults = [
      { key: 'thrift', label: `THRIFT — ${thrift.name}`, note: thrift.note, mult: thriftMult },
      { key: 'speed', label: `SPEED — ${speed.name}`, note: `${plies} of ${this.plyLimit} half-moves`, mult: speedMult }
    ];

    return {
      lines, mults, subtotal, thrift, speed, thriftMult, speedMult,
      afterMults, refund, total, capturedValue, survivingValue
    };
  }

  // --- end of fight --------------------------------------------------------
  finishRound(outcome, plies, { capturedValue = 0, survivingValue = 0, finalEvalCp = null } = {}) {
    const b = this.bonus;
    let result = outcome;

    // OVERTIME: ran out of moves but crushing? Take the win.
    let overtimeUsed = false;
    if (result === 'timeout' && b.overtime && finalEvalCp != null && finalEvalCp >= b.overtime) {
      result = 'win'; overtimeUsed = true;
    }
    const won = result === 'win';

    const payload = {
      round: this.round, wave: this.wave, isBoss: this.isBoss, won, result, plies,
      plyLimit: this.plyLimit, spent: this.spentThisRound,
      bought: this.placed.map(p => p.type), fishLevel: this.fishLevel,
      themeId: this.enemy.theme.id, overtimeUsed, startEdge: this.startEdge,
      bossName: this.boss ? this.boss.name : null,
      perkTotal: Object.values(this.perks).reduce((s, n) => s + n, 0)
    };

    if (won) {
      const pay = this.computePayout({ plies, capturedValue, survivingValue });
      this.money += pay.total;
      this.totalEarned += pay.total;
      payload.pay = pay;
      payload.thriftName = pay.thrift.name;
      payload.thriftMult = pay.thriftMult;
      payload.speedMult = pay.speedMult;
      payload.total = pay.total;
      this.phase = (this.boss && this.boss.id === 'prime') ? PHASE.WON : PHASE.RESULT;
    } else {
      // Permadeath. One loss and the run is over -- no lives, no retries.
      this.phase = PHASE.OVER;
    }

    this.history.push(payload);
    this.lastResult = payload;
    return payload;
  }

  // --- THE LAB (permanent stats, always available) -------------------------
  labItems() {
    const items = [];
    if (this.fishLevel < 20) items.push({
      id: 'fish', name: 'FEED THE FISH', icon: 'fish',
      cost: CONFIG.fishUpgradeCost(this.fishLevel),
      value: `Skill ${this.fishLevel} → ${this.fishLevel + 1}`,
      desc: 'A smarter fish needs less material — and less material means a bigger THRIFT multiplier.'
    });
    items.push({
      id: 'patience', name: 'PATIENCE', icon: 'clock',
      cost: CONFIG.patienceCost(this.patience / CONFIG.PATIENCE_GAIN),
      value: `+${CONFIG.PATIENCE_GAIN} half-moves, every fight`,
      desc: 'More room on the clock. Careful: a longer limit makes the SPEED multiplier harder to reach.'
    });
    return items;
  }

  buyLab(id) {
    const item = this.labItems().find(i => i.id === id);
    if (!item || this.money < item.cost) return { ok: false };
    this.money -= item.cost;
    if (id === 'fish') this.fishLevel++;
    if (id === 'patience') this.patience += CONFIG.PATIENCE_GAIN;
    return { ok: true, item };
  }

  // --- THE BLACK MARKET (random perks) -------------------------------------
  rollOffer() {
    this.offer = rollOffer(this.perks, this.rand, CONFIG.PERK_OFFERS);
    return this.offer;
  }
  rerollPrice() { return CONFIG.rerollCost(this.rerolls); }
  reroll() {
    const cost = this.rerollPrice();
    if (this.money < cost) return { ok: false };
    this.money -= cost;
    this.rerolls++;
    this.rollOffer();
    return { ok: true, cost };
  }
  buyPerk(id) {
    const perk = this.offer.find(p => p.id === id) || PERK_BY_ID[id];
    if (!perk) return { ok: false };
    const have = this.perkCount(id);
    if (have >= (perk.max || 1)) return { ok: false, msg: 'Already maxed.' };
    if (this.money < perk.cost) return { ok: false, msg: 'Not enough money.' };
    this.money -= perk.cost;
    this.perks[id] = have + 1;
    this.offer = this.offer.filter(p => p.id !== id);
    return { ok: true, perk };
  }
  ownedPerks() {
    return Object.entries(this.perks)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ ...PERK_BY_ID[id], count: n }));
  }
}

const SPEED_BEST = { maxFrac: 0.35, mult: 1.5, name: 'SURGICAL' };
