// Run-Zustand, Oekonomie, Rundenablauf. Kein DOM hier drin.
import { CONFIG, plyLimitFor, requiredEdgeCp } from './config.js';
import { COST, VALUE, PLAYER_KING_SQUARE, PLAYER_COLOR, PLAYER_ZONE, isLegalPlacement } from './rules.js';
import { generateEnemy } from './generator.js';
import { validateSetup } from './validate.js';
import { Chess } from '../vendor/chess.js';
import { buildFen } from './rules.js';

export const PHASE = { BOOT: 'boot', PLACE: 'place', SIM: 'sim', RESULT: 'result', SHOP: 'shop', OVER: 'over' };

export class Game {
  constructor(seed = Math.floor(Math.random() * 1e9)) {
    this.seed = seed;
    this.reset();
  }

  reset() {
    this.round = 0;
    this.money = CONFIG.START_MONEY;
    this.hearts = CONFIG.START_HEARTS;
    this.fishLevel = CONFIG.START_FISH_LEVEL;
    this.patience = 0;
    this.discount = 0;
    this.phase = PHASE.BOOT;
    this.enemy = null;
    this.placed = [];        // gekaufte Figuren [{type,color,square}]
    this.spentThisRound = 0;
    this.lastResult = null;
    this.history = [];
  }

  // --- Preise ------------------------------------------------------------
  priceOf(type) { return Math.max(1, COST[type] - this.discount); }
  canAfford(type) { return this.money >= this.priceOf(type); }

  // --- Runde starten -----------------------------------------------------
  startRound() {
    this.round++;
    this.enemy = generateEnemy(this.round, this.seed);
    this.placed = [];
    this.spentThisRound = 0;
    this.phase = PHASE.PLACE;
    this.plyLimit = plyLimitFor({
      enemyMaterial: this.enemy.material,
      fishLevel: this.fishLevel,
      patienceBonus: this.patience
    });
    return this.enemy;
  }

  // --- Platzieren --------------------------------------------------------
  playerPieces() {
    return [{ type: 'k', color: PLAYER_COLOR, square: PLAYER_KING_SQUARE }, ...this.placed];
  }
  occupied() {
    const s = new Set([PLAYER_KING_SQUARE]);
    for (const p of this.placed) s.add(p.square);
    for (const p of this.enemy.pieces) s.add(p.square);
    return s;
  }

  // Felder, auf denen die Figur Weiss SOFORT jeden Zug nehmen wuerde -- also
  // Matt oder Patt, noch bevor Weiss einmal gezogen hat. Schach DROHEN ist
  // erlaubt und erwuenscht; fertig mattsetzen ohne Gegenwehr nicht.
  forbiddenSquares(type) {
    const set = new Set();
    if (!type || !this.enemy) return set;
    const c = new Chess();
    try { c.load(buildFen([...this.enemy.pieces, ...this.playerPieces()], 'w'), { skipValidation: true }); }
    catch (e) { return set; }
    const occ = this.occupied();
    for (let rank = PLAYER_ZONE[0]; rank <= PLAYER_ZONE[1]; rank++) {
      for (const f of 'abcdefgh') {
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
    if (rank < PLAYER_ZONE[0] || rank > PLAYER_ZONE[1])
      return { ok: false, msg: `Du darfst nur auf deiner Haelfte bauen (Reihe ${PLAYER_ZONE[0]}-${PLAYER_ZONE[1]}).` };
    if (!isLegalPlacement(square, type)) return { ok: false, msg: 'Bauern koennen nicht auf Reihe 8 stehen.' };
    if (this.occupied().has(square)) return { ok: false, msg: 'Da steht schon jemand.' };
    if (this.forbiddenSquares(type).has(square))
      return { ok: false, msg: 'Damit waere Weiss sofort matt oder patt - Weiss braucht mindestens einen Zug.' };
    const price = this.priceOf(type);
    if (this.money < price) return { ok: false, msg: 'Zu teuer.' };
    this.money -= price;
    this.spentThisRound += price;
    this.placed.push({ type, color: PLAYER_COLOR, square });
    return { ok: true, price };
  }

  sell(square) {
    const i = this.placed.findIndex(p => p.square === square);
    if (i < 0) return { ok: false };
    const p = this.placed[i];
    const price = this.priceOf(p.type);
    this.placed.splice(i, 1);
    this.money += price;
    this.spentThisRound -= price;
    return { ok: true, refund: price, type: p.type };
  }

  clearBoard() {
    while (this.placed.length) this.sell(this.placed[0].square);
  }

  validate() { return validateSetup(this.enemy.pieces, this.playerPieces()); }

  materialEdge() {
    const mine = this.playerPieces().reduce((s, p) => s + (VALUE[p.type] || 0), 0);
    return mine - this.enemy.material;
  }
  requiredEdge() { return requiredEdgeCp(this.fishLevel); }

  // --- Ergebnis ----------------------------------------------------------
  finishRound(result, plies) {
    const won = result === 'win';
    const payload = {
      round: this.round, won, result, plies,
      plyLimit: this.plyLimit,
      spent: this.spentThisRound,
      bought: this.placed.map(p => p.type),
      fishLevel: this.fishLevel,
      themeId: this.enemy.theme.id,
      moneyBefore: this.money
    };
    if (won) {
      const income = CONFIG.income(this.round);
      this.money += income;
      payload.income = income;
    } else {
      this.hearts--;
      payload.heartsLeft = this.hearts;
    }
    this.history.push(payload);
    this.lastResult = payload;
    this.phase = this.hearts <= 0 ? PHASE.OVER : PHASE.RESULT;
    return payload;
  }

  // --- Shop --------------------------------------------------------------
  shopItems() {
    const items = [];
    if (this.fishLevel < 20) {
      items.push({
        id: 'fish', name: 'FISCH FUETTERN', cost: CONFIG.fishUpgradeCost(this.fishLevel),
        desc: `Skill-Level ${this.fishLevel} -> ${this.fishLevel + 1}. Dein Fisch spielt besser, du brauchst weniger Material.`,
        icon: 'fish'
      });
    }
    if (this.hearts < CONFIG.MAX_HEARTS) {
      items.push({ id: 'heart', name: 'EXTRA-HERZ', cost: CONFIG.HEART_COST,
        desc: 'Ein Leben mehr. Teuer, aber du weisst ja, wie das laeuft.', icon: 'heart' });
    }
    items.push({ id: 'patience', name: 'GEDULD', cost: CONFIG.PATIENCE_COST,
      desc: `+${CONFIG.PATIENCE_GAIN} Halbzuege in JEDER Runde. Dauerhaft.`, icon: 'clock' });
    if (this.discount < CONFIG.MAX_DISCOUNT) {
      items.push({ id: 'discount', name: 'RABATTMARKE', cost: CONFIG.DISCOUNT_COST,
        desc: 'Jede Figur kostet dauerhaft 1$ weniger.', icon: 'coin' });
    }
    return items;
  }

  buyShop(id) {
    const item = this.shopItems().find(i => i.id === id);
    if (!item || this.money < item.cost) return { ok: false };
    this.money -= item.cost;
    if (id === 'fish') this.fishLevel++;
    if (id === 'heart') this.hearts++;
    if (id === 'patience') this.patience += CONFIG.PATIENCE_GAIN;
    if (id === 'discount') this.discount++;
    return { ok: true, item };
  }
}
