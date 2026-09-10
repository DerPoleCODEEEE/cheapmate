// ============================================================================
// Run state, economy, waves, bosses, perks. No DOM in here, so it all stays
// testable from Node.
// ============================================================================
import { CONFIG, plyLimitFor, requiredEdgeCp, movetimeFor } from './config.js';
import {
  COST, VALUE, PLAYER_KING_SQUARE, PLAYER_COLOR, ENEMY_COLOR, PLAYER_ZONE,
  isLegalPlacement, buildFen, FILES, countTypes, armyLegalityProblem
} from './rules.js';
import { generateEnemy } from './generator.js';
import { validateSetup } from './validate.js';
import { scheduleFor, bossForWave, RANK_TAUNTS } from './content.js';
import { PERKS, PERK_BY_ID, rollOffer, totals } from './perks.js';
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
    this.hearts = CONFIG.START_HEARTS;
    this.heartsBought = 0;
    this.fishLevel = CONFIG.START_FISH_LEVEL;
    this.overclock = 0;
    this.patience = 0;
    this.perks = {};                 // id -> count
    this.phase = PHASE.BOOT;
    this.enemy = null;
    this.boss = null;
    this.placed = [];
    this.freeCredits = {};
    this.spentThisRound = 0;
    this.lastResult = null;
    this.history = [];
    this.rerolls = 0;
    this.offer = [];
    this.insuranceUsedInWave = false;
    this.rand = mulberry(this.seed ^ 0x9e3779b9);
  }

  // --- perk helpers --------------------------------------------------------
  get bonus() { return totals(this.perks); }
  perkCount(id) { return this.perks[id] || 0; }
  get movetime() { return movetimeFor(this.overclock); }

  // --- prices --------------------------------------------------------------
  priceOf(type) {
    if ((this.freeCredits[type] || 0) > 0) return 0;
    const b = this.bonus;
    let base = b.priceSet[type] != null ? b.priceSet[type] : COST[type];
    return Math.max(1, base + b.priceAll);
  }

  placementMinRank() {
    return this.bonus.beachhead > 0 ? 4 : PLAYER_ZONE[0];
  }
  beachheadUsed() {
    return this.placed.filter(p => +p.square[1] === 4).length;
  }

  // --- starting a fight ----------------------------------------------------
  startRound() {
    this.round++;
    const sched = scheduleFor(this.round);
    this.wave = sched.wave;
    this.isBoss = sched.isBoss;
    this.slot = sched.slot;
    if (sched.slot === 1) this.insuranceUsedInWave = false;

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
    this.capturesThisRound = 0;
    this.phase = PHASE.PLACE;

    // free pieces from perks
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

    // Stockfish weigert sich, unmoegliche Armeen zu bewerten -> vorher abfangen.
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
    if (p.free) { this.freeCredits[p.type] = (this.freeCredits[p.type] || 0) + 1; return { ok: true, refund: 0, free: true, type: p.type }; }
    const refund = Math.max(1, (this.bonus.priceSet[p.type] != null ? this.bonus.priceSet[p.type] : COST[p.type]) + this.bonus.priceAll);
    this.money += refund;
    this.spentThisRound -= refund;
    return { ok: true, refund, type: p.type };
  }

  clearBoard() { while (this.placed.length) this.sell(this.placed[0].square); }

  // Fuer die UI: welche Typen sind gerade ueberhaupt noch kaufbar?
  typeBlocked(type) {
    const after = countTypes(this.placed);
    after[type] = (after[type] || 0) + 1;
    return armyLegalityProblem(after);
  }

  validate() { return validateSetup(this.enemy.pieces, this.playerPieces()); }

  materialEdge() {
    const mine = this.playerPieces().reduce((s, p) => s + (VALUE[p.type] || 0), 0);
    return mine - this.enemy.material;
  }
  requiredEdge() { return requiredEdgeCp(this.fishLevel); }

  // THE MIRROR copies your most expensive purchase onto White's side.
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

  // --- end of fight --------------------------------------------------------
  finishRound(outcome, plies, { captures = 0, finalEvalCp = null } = {}) {
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
      themeId: this.enemy.theme.id, captures, overtimeUsed, heartSaved: false,
      bossName: this.boss ? this.boss.name : null
    };

    if (won) {
      let income = CONFIG.income(this.round) + b.income;
      if (this.isBoss) income += CONFIG.bossBonus(this.wave);
      const bounty = captures * b.perCapture;
      const refund = Math.round(Math.max(0, this.spentThisRound) * b.refund);
      this.money += income + bounty + refund;
      Object.assign(payload, { income, bounty, refund, total: income + bounty + refund });
      if (this.isBoss && b.healOnBoss) {
        const heal = Math.min(b.healOnBoss, this.maxHearts() - this.hearts);
        if (heal > 0) { this.hearts += heal; payload.healed = heal; }
      }
    } else {
      if (b.heartGuard && !this.insuranceUsedInWave) {
        this.insuranceUsedInWave = true;
        payload.heartSaved = true;
      } else {
        this.hearts--;
      }
      payload.heartsLeft = this.hearts;
    }

    this.history.push(payload);
    this.lastResult = payload;
    if (this.hearts <= 0) this.phase = PHASE.OVER;
    else if (won && this.boss && this.boss.id === 'prime') this.phase = PHASE.WON;
    else this.phase = PHASE.RESULT;
    return payload;
  }

  maxHearts() { return Math.min(CONFIG.MAX_HEARTS, CONFIG.START_HEARTS + this.heartsBought + 1); }

  // --- THE LAB (permanent stats, always available) -------------------------
  labItems() {
    const items = [];
    if (this.fishLevel < 20) items.push({
      id: 'fish', name: 'FEED THE FISH', icon: 'fish',
      cost: CONFIG.fishUpgradeCost(this.fishLevel),
      value: `Skill ${this.fishLevel} → ${this.fishLevel + 1}`,
      desc: 'A smarter fish needs less material. This is the main line.'
    });
    if (this.overclock < CONFIG.MAX_OVERCLOCK) items.push({
      id: 'overclock', name: 'OVERCLOCK', icon: 'bolt',
      cost: CONFIG.overclockCost(this.overclock),
      value: `${this.movetime}ms → ${this.movetime + CONFIG.MOVETIME_STEP}ms per move`,
      desc: 'More thinking time. Measured: worth a lot to a dumb fish, almost nothing to a clever one.'
    });
    items.push({
      id: 'patience', name: 'PATIENCE', icon: 'clock',
      cost: CONFIG.patienceCost(this.patience / CONFIG.PATIENCE_GAIN),
      value: `+${CONFIG.PATIENCE_GAIN} half-moves, every fight`,
      desc: 'More time on the clock to land the mate.'
    });
    if (this.hearts < this.maxHearts()) items.push({
      id: 'heart', name: 'SPARE HEART', icon: 'heart',
      cost: CONFIG.heartCost(this.heartsBought),
      value: `${this.hearts} → ${this.hearts + 1} lives`,
      desc: 'Expensive. You know why.'
    });
    return items;
  }

  buyLab(id) {
    const item = this.labItems().find(i => i.id === id);
    if (!item || this.money < item.cost) return { ok: false };
    this.money -= item.cost;
    if (id === 'fish') this.fishLevel++;
    if (id === 'overclock') this.overclock++;
    if (id === 'patience') this.patience += CONFIG.PATIENCE_GAIN;
    if (id === 'heart') { this.hearts++; this.heartsBought++; }
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
