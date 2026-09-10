window.__cheapmateAlive = true;

import { Chess } from '../vendor/chess.js';
import { CONFIG, riskBand } from './config.js';
import { PIECE_NAME, VALUE, fishTier, nextFishTier, FILES, PLAYER_KING_SQUARE,
         PLAYER_COLOR, ENEMY_COLOR, PLAYER_ZONE } from './rules.js';
import { Game, PHASE } from './game.js';
import { Engine } from './engine.js';
import { AchievementTracker, ACHIEVEMENTS } from './achievements.js';
import { ROUGH_DEFS, pieceSvg, fishSvg, icon, COIN_SOLID, PRIME_SVG } from './art.js';
import { SKIRMISHES_PER_WAVE, scheduleFor } from './content.js';
import { RARITY } from './perks.js';
import { sfx } from './sfx.js';
import { playIntro, introSeen } from './intro.js';

const $ = s => document.querySelector(s);
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

document.getElementById('rough-defs').innerHTML = ROUGH_DEFS;
$('#boot-fish').innerHTML = fishSvg('stick', { size: 210 });
$('#money-ico').innerHTML = COIN_SOLID;

// ===========================================================================
// State
// ===========================================================================
const game = new Game();
const myFish  = new Engine('you');
const foeFish = new Engine('enemy');
const referee = new Engine('referee');   // neutral judge: eval bar + mate instinct
const trophies = new AchievementTracker(a => showToast(a));

let selectedType = null;
let speed = 2;
let skipping = false;
let chess = null;
const pieceEls = new Map();

// ===========================================================================
// Toasts
// ===========================================================================
const TIER_ICON = { 1: '●', 2: '◆', 3: '★' };
function showToast(a) {
  sfx.play('achievement');
  const t = el('div', `toast tier${a.tier}`);
  t.innerHTML = `
    <div class="rays">${Array.from({ length: 10 }, (_, i) =>
      `<i style="transform:rotate(${i * 36}deg) translateY(-14px);animation-delay:${i * 18}ms"></i>`).join('')}</div>
    <div class="t-badge">${TIER_ICON[a.tier]}</div>
    <div><div class="t-kicker">Unlocked</div>
      <div class="t-name">${a.name}</div><div class="t-desc">${a.desc}</div></div>`;
  $('#toast-root').appendChild(t);
  setTimeout(() => { const r = t.querySelector('.rays'); if (r) r.remove(); }, 800);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 420); }, 4600);
  updateTrophyCount();
}
function updateTrophyCount() { $('#trophy-count').textContent = trophies.progress().done; }

// ===========================================================================
// Modal
// ===========================================================================
function modal(html, { dismissable = false, wide = false } = {}) {
  const bg = el('div', 'modal-bg');
  bg.innerHTML = `<div class="modal"${wide ? ' style="max-width:900px"' : ''}>${html}</div>`;
  if (dismissable) bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
  $('#modal-root').appendChild(bg);
  return bg;
}

// ===========================================================================
// Board — drawn from BLACK's point of view: rank 1 at the top, h-file on the
// left, so your own half sits at the bottom where your hands are.
// ===========================================================================
function squareToXY(sq) {
  return { f: 7 - (sq.charCodeAt(0) - 97), r: parseInt(sq[1], 10) - 1 };
}

function buildBoard() {
  const b = $('#board');
  b.innerHTML = '';
  const minRank = game.placementMinRank();
  for (let r = 1; r <= 8; r++) {
    for (const f of [...FILES].reverse()) {
      const d = el('div', 'sq' + (((f.charCodeAt(0) - 97) + r) % 2 === 0 ? ' dark' : ''));
      d.dataset.square = f + r;
      if (r >= PLAYER_ZONE[0]) d.classList.add('zone');
      else if (r >= minRank) { d.classList.add('zone'); d.classList.add('beach'); }
      if (f === 'h') d.appendChild(el('span', 'sq-coord', String(r)));
      if (r === 8) d.appendChild(el('span', 'sq-coord', f));
      b.appendChild(d);
    }
  }
  b.onclick = onBoardClick;
}

function placePieceEl(piece, { animate = false } = {}) {
  const mine = piece.color === PLAYER_COLOR;
  const e = el('div', 'pc' + (mine ? ' mine' : '') + (piece.free ? ' free' : '') + (animate ? ' placing' : ''));
  e.innerHTML = pieceSvg(piece.type, piece.color);
  e.dataset.square = piece.square;
  const { f, r } = squareToXY(piece.square);
  e.style.transform = `translate(calc(${f} * var(--cell)), calc(${r} * var(--cell)))`;
  if (mine && piece.square !== PLAYER_KING_SQUARE) {
    e.addEventListener('click', ev => {
      ev.stopPropagation();
      if (game.phase === PHASE.PLACE) sellAt(e.dataset.square);
    });
  }
  $('#piece-layer').appendChild(e);
  pieceEls.set(piece.square, e);
  return e;
}

function renderAllPieces() {
  $('#piece-layer').innerHTML = '';
  pieceEls.clear();
  for (const p of game.enemy.pieces) placePieceEl(p);
  for (const p of game.playerPieces()) placePieceEl(p);
}

function inkSplat(square) {
  const { f, r } = squareToXY(square);
  const s = el('div', 'splat');
  s.style.transform = `translate(calc(${f} * var(--cell)), calc(${r} * var(--cell)))`;
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + Math.random();
    const dist = 16 + Math.random() * 24;
    const dot = el('i');
    dot.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    dot.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
    dot.style.animationDelay = `${i * 8}ms`;
    s.appendChild(dot);
  }
  $('#fx-layer').appendChild(s);
  setTimeout(() => s.remove(), 700);
}

function coinPop(square) {
  const { f, r } = squareToXY(square);
  const c = el('div', 'coinfly', COIN_SOLID);
  c.style.left = `calc(${f} * var(--cell) + var(--cell) / 2 - 13px)`;
  c.style.top = `calc(${r} * var(--cell))`;
  $('#fx-layer').appendChild(c);
  setTimeout(() => c.remove(), 850);
}

function animateMove(mv, { instinct = false } = {}) {
  const fromEl = pieceEls.get(mv.from);
  if (!fromEl) return;
  if (mv.captured) {
    const capSq = mv.flags.includes('e') ? mv.to[0] + mv.from[1] : mv.to;
    const victim = pieceEls.get(capSq);
    if (victim) {
      victim.classList.add('dying');
      pieceEls.delete(capSq);
      inkSplat(capSq);
      setTimeout(() => victim.remove(), 320);
    }
  }
  pieceEls.delete(mv.from);
  const { f, r } = squareToXY(mv.to);
  fromEl.style.transform = `translate(calc(${f} * var(--cell)), calc(${r} * var(--cell)))`;
  fromEl.dataset.square = mv.to;
  if (instinct) { fromEl.classList.add('instinct'); setTimeout(() => fromEl.classList.remove('instinct'), 650); }
  if (mv.promotion) setTimeout(() => {
    fromEl.innerHTML = pieceSvg(mv.promotion, mv.color);
    fromEl.classList.add('placing');
  }, 190);
  pieceEls.set(mv.to, fromEl);
  document.querySelectorAll('.sq.lastmove').forEach(s => s.classList.remove('lastmove'));
  const a = document.querySelector(`.sq[data-square="${mv.from}"]`);
  const b = document.querySelector(`.sq[data-square="${mv.to}"]`);
  if (a) a.classList.add('lastmove');
  if (b) b.classList.add('lastmove');
}

// ===========================================================================
// Evaluation bar
// ===========================================================================
function setEval(cp, mate) {
  const fill = $('#eval-fill'), num = $('#eval-num');
  if (cp == null && mate == null) { fill.style.height = '50%'; num.textContent = '–'; return; }
  let share, label;
  if (mate != null) {
    share = mate > 0 ? 1 : 0;
    label = (mate > 0 ? 'M' : '-M') + Math.abs(mate);
  } else {
    share = 1 / (1 + Math.exp(-cp / 380));
    label = (cp >= 0 ? '+' : '') + (cp / 100).toFixed(1);
  }
  fill.style.height = (share * 100).toFixed(1) + '%';
  num.textContent = label;
}

function showEval(r, scoreIsFromPlayer) {
  const flip = scoreIsFromPlayer ? 1 : -1;
  const cp = r.cp != null ? r.cp * flip : null;
  const mate = r.mate != null ? r.mate * flip : null;
  setEval(cp, mate);
  return cp != null ? cp : (mate != null ? (mate > 0 ? 9999 : -9999) : null);
}

// ===========================================================================
// Recruit rail
// ===========================================================================
function renderShopRail() {
  const wrap = $('#shop-pieces');
  wrap.innerHTML = '';
  for (const type of ['p', 'n', 'b', 'r', 'q']) {
    const credits = game.freeCredits[type] || 0;
    const price = game.priceOf(type);
    const blocked = game.typeBlocked(type);          // the 16-men limit
    const broke = !!blocked || (credits === 0 && game.money < price);
    const item = el('div', 'shop-item' + (broke ? ' broke' : '') + (selectedType === type ? ' selected' : ''));
    if (blocked) item.title = blocked;
    item.innerHTML = `<div class="si-icon">${pieceSvg(type, PLAYER_COLOR, { size: 31 })}</div>
      <div class="si-name">${PIECE_NAME[type]}</div>
      <div class="si-price">${credits > 0 ? `<span class="si-free">FREE ×${credits}</span>` : '$' + price}</div>`;
    item.onclick = () => {
      if (broke) { sfx.play('error'); flashStatus(blocked || 'Not enough money for that.'); return; }
      sfx.play('uiClick');
      selectedType = selectedType === type ? null : type;
      renderShopRail(); markPlaceable();
    };
    wrap.appendChild(item);
  }
  $('#budget-note').textContent = selectedType
    ? `${PIECE_NAME[selectedType]} selected — click a square.`
    : 'Pick a piece, then a square. Click one of yours to sell it back.';
}

function markPlaceable() {
  const occ = game.occupied();
  const forbidden = selectedType ? game.forbiddenSquares(selectedType) : new Set();
  const minRank = game.placementMinRank();
  const beachLeft = game.bonus.beachhead - game.beachheadUsed();
  document.querySelectorAll('.sq').forEach(s => {
    s.classList.remove('can-place', 'hint');
    if (game.phase !== PHASE.PLACE || !selectedType) return;
    const sq = s.dataset.square, rank = +sq[1];
    if (rank < minRank || occ.has(sq)) return;
    if (selectedType === 'p' && rank === 8) return;
    if (forbidden.has(sq)) return;
    if (rank === 4 && beachLeft <= 0) return;
    s.classList.add('can-place');
    s.classList.add('hint');
  });
}

function onBoardClick(ev) {
  if (game.phase !== PHASE.PLACE) return;
  const cell = ev.target.closest('.sq');
  if (!cell) return;
  if (!selectedType) { flashStatus('Pick a piece from the left first.'); return; }
  const r = game.buy(selectedType, cell.dataset.square);
  if (!r.ok) {
    sfx.play('error');
    flashStatus(r.msg);
    if (r.msg.indexOf('mate or stalemate') >= 0) trophies.fire('illegalSetup', { reason: 'instantwin' });
    return;
  }
  sfx.play('place');
  placePieceEl({ type: selectedType, color: PLAYER_COLOR, square: cell.dataset.square, free: r.free }, { animate: true });
  if (!(game.freeCredits[selectedType] > 0) && game.money < game.priceOf(selectedType)) selectedType = null;
  refreshPlacement();
}

function sellAt(sq) {
  const r = game.sell(sq);
  if (!r.ok) return;
  sfx.play('sell');
  const e = pieceEls.get(sq);
  if (e) { e.classList.add('dying'); pieceEls.delete(sq); setTimeout(() => e.remove(), 300); }
  refreshPlacement();
}

function refreshPlacement() {
  renderShopRail(); markPlaceable(); updateHud();
  const v = game.validate();
  const edge = game.materialEdge();
  $('#material-val').textContent = (edge >= 0 ? '+' : '') + edge;
  $('#plies-val').textContent = Math.floor(game.plyLimit / 2);

  // The bet, shown before it is taken. Under permadeath this is the whole UI.
  const prev = game.previewPayout();
  const cell = $('#dash-thrift');
  $('#thrift-mult').textContent = '×' + prev.thrift.mult.toFixed(2);
  $('#thrift-name').textContent = prev.thrift.name;
  cell.classList.toggle('hot', prev.thrift.mult >= 1.8);
  $('#payout-est').textContent = game.placed.length ? `$${prev.low}–${prev.high}` : '–';

  const verdict = $('#verdict'), start = $('#btn-start');
  if (!v.ok) {
    verdict.className = 'verdict bad';
    verdict.textContent = v.msg;
    start.disabled = true;
  } else if (!game.placed.length) {
    verdict.className = 'verdict';
    verdict.textContent = 'Only your king is out there. That will not end well.';
    start.disabled = true;
  } else if (v.whiteMateIn1) {
    verdict.className = 'verdict bad';
    verdict.textContent = `WHITE HAS MATE IN ONE (${v.whiteMateIn1}). It moves first — fix this or you lose the run.`;
    start.disabled = false;
  } else {
    // The advisor is calibrated against measured win rates, not vibes: at
    // ratio 1.0 you are only a ~75% favourite, and under permadeath that is
    // a gamble, so it is labelled as one.
    const need = Math.max(1, game.requiredEdge() / 100);
    const band = riskBand(edge / need);
    verdict.className = 'verdict ' + band.tone;
    verdict.innerHTML = `<b>${prev.thrift.name} ×${prev.thrift.mult.toFixed(2)}</b> &nbsp;·&nbsp; ` +
                        `${band.label.toUpperCase()} &nbsp;·&nbsp; ${band.text}`;
    start.disabled = false;
  }
}

let statusTimer;
function flashStatus(msg) {
  const t = $('#status-text');
  t.textContent = msg;
  t.classList.add('warn');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { t.classList.remove('warn'); t.textContent = defaultStatus(); }, 2400);
}
function defaultStatus() {
  if (game.phase === PHASE.PLACE) return `Build on ranks ${game.placementMinRank()}–8. White moves first.`;
  if (game.phase === PHASE.SIM) return 'The engines are playing. You watch.';
  return '';
}

// ===========================================================================
// Dashboard + right rail
// ===========================================================================
function pulse(sel) {
  const e = $(sel);
  if (!e) return;
  e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse');
}

function updateHud() {
  $('#money-val').textContent = game.money;
  $('#wave-num').textContent = game.wave;

  const dots = $('#wave-dots');
  const slot = game.round ? scheduleFor(game.round).slot : 0;
  dots.innerHTML = '';
  for (let i = 1; i <= SKIRMISHES_PER_WAVE + 1; i++) {
    dots.appendChild(el('span', 'wdot' + (i === SKIRMISHES_PER_WAVE + 1 ? ' boss' : '') +
      (slot && i < slot ? ' done' : '') + (slot && i === slot ? ' now' : '')));
  }

  const tier = fishTier(game.fishLevel);
  $('#fish-ico').innerHTML = fishSvg(tier.art, { size: 62 });
  $('#fish-name').textContent = tier.name;
  $('#fish-sub').textContent = `skill ${game.fishLevel} / 20`;
  $('#fish-bar').style.width = (game.fishLevel / 20 * 100) + '%';

  renderRunStats();
  renderPerkChips();
  trophies.fire('money', { money: game.money });
}

// Everything permanent you own, always visible, no clicking required.
function renderRunStats() {
  const b = game.bonus;
  const rows = [
    ['Fights won', game.history.filter(h => h.won).length],
    ['Earned this run', '$' + game.totalEarned],
    ['Clock bonus', game.patience ? `+${game.patience} half-moves` : '—'],
    ['Thrift bonus', b.thrift ? `+${b.thrift.toFixed(2)}` : '—'],
    ['Speed bonus', b.speed ? `+${b.speed.toFixed(2)}` : '—'],
    ['Free pieces', Object.keys(b.freeEach).length
      ? Object.entries(b.freeEach).map(([t, n]) => `${n}×${PIECE_NAME[t]}`).join(', ') : '—']
  ];
  $('#run-stats').innerHTML = rows
    .map(([k, v]) => `<div class="run-stat"><span>${k}</span><span>${v}</span></div>`).join('');
}

function renderPerkChips(freshId) {
  const box = $('#perk-chips');
  const owned = game.ownedPerks();
  $('#perk-count').textContent = owned.reduce((s, p) => s + p.count, 0);
  if (!owned.length) {
    box.innerHTML = '<span class="chips-empty">None yet. The Black Market opens after your first win.</span>';
    return;
  }
  box.innerHTML = owned.map(p =>
    `<span class="chip ${p.rarity}${p.id === freshId ? ' fresh' : ''}" title="${p.desc}">
       ${icon(p.icon, { size: 17 })}<b>${p.name}${p.count > 1 ? ' ×' + p.count : ''}</b></span>`).join('');
}

// ===========================================================================
// Boss intro
// ===========================================================================
function bossIntro(boss) {
  return new Promise(resolve => {
    sfx.play(boss.id === 'prime' ? 'primeHum' : 'bossIn');
    const bg = modal(`<div class="boss-card">
      <div class="boss-art">${boss.id === 'prime' ? PRIME_SVG : icon('skull', { size: 150 })}</div>
      <div class="boss-title">${boss.title}</div>
      <div class="boss-name">${boss.name}</div>
      <p class="boss-taunt">&ldquo;${boss.taunt}&rdquo;</p>
      <div class="boss-mod">${boss.modText}</div>
      <div class="modal-actions"><button class="big-btn" id="m-face">FACE IT</button></div>
    </div>`);
    bg.querySelector('#m-face').onclick = () => { sfx.play('uiClick'); bg.remove(); resolve(); };
  });
}

// ===========================================================================
// Simulation
// ===========================================================================
async function runSimulation() {
  game.phase = PHASE.SIM;

  const mirrored = game.applyMirror();
  if (mirrored) {
    placePieceEl(mirrored, { animate: true });
    sfx.play('glitch');
    flashStatus(`THE MIRROR copies your ${PIECE_NAME[mirrored.type].toLowerCase()}.`);
    await sleep(900);
  }
  game.lockInEdge();

  const v = game.validate();
  chess = new Chess();
  chess.load(v.fen, { skipValidation: true });

  $('#rail-left').classList.add('hidden');
  $('#speed-row').classList.remove('hidden');
  $('#btn-start').classList.add('hidden');
  $('#verdict').classList.add('hidden');
  $('#status-text').textContent = 'The engines are playing. You watch.';
  document.querySelectorAll('.sq').forEach(s => {
    s.classList.remove('can-place', 'hint', 'zone', 'beach');
  });

  await Promise.all([myFish.newGame(), foeFish.newGame(), referee.newGame()]);

  let plies = 0, outcome = 'timeout', capturedValue = 0, lastEval = null;

  while (plies < game.plyLimit) {
    if (chess.isGameOver()) {
      outcome = chess.isCheckmate() ? (chess.turn() === ENEMY_COLOR ? 'win' : 'loss') : 'draw';
      break;
    }
    const mine = chess.turn() === PLAYER_COLOR;
    let move = null, instinct = false;

    if (mine) {
      // MATE INSTINCT. However bad your fish is, it never misses a forced mate.
      // The neutral referee looks first; if it sees a mate for you, that move
      // is played. The same search feeds the evaluation bar, so this costs one
      // search per move of yours and nothing on top.
      const probe = await referee.search(chess.fen(), {
        skill: 20, depth: CONFIG.MATE_INSTINCT_DEPTH
      });
      const ev = showEval(probe, true);
      if (ev != null) lastEval = ev;

      if (probe.mate != null && probe.mate > 0 && probe.move) {
        move = probe.move;
        instinct = true;
      } else {
        const myPieces = chess.board().flat()
          .filter(c => c && c.color === PLAYER_COLOR && c.type !== 'k').length;
        const r = await myFish.search(chess.fen(), {
          skill: game.effectiveSkill({ ply: plies, myPieces }),
          movetime: game.movetime
        });
        move = r.move;
      }
    } else {
      const r = await foeFish.search(chess.fen(), { skill: 20, movetime: CONFIG.MOVETIME_ENEMY });
      move = r.move;
      const ev = showEval(r, false);   // full strength, so its own score is fair
      if (ev != null) lastEval = ev;
    }

    if (!move) { outcome = chess.moves().length ? 'draw' : (mine ? 'loss' : 'win'); break; }

    let mv;
    try {
      mv = chess.move(move, { strict: false });
    } catch (e) {
      try {
        mv = chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] || 'q' });
      } catch (e2) { outcome = 'draw'; break; }
    }
    plies++;
    if (mv.captured && mine) {
      capturedValue += VALUE[mv.captured] || 0;
      if (!skipping) coinPop(mv.to);
    }

    if (!skipping) {
      animateMove(mv, { instinct });
      sfx.play(mv.captured ? 'capture' : 'move');
      if (instinct) flashStatus('MATE INSTINCT — your fish saw it.');
      $('#plies-val').textContent = Math.ceil((game.plyLimit - plies) / 2);
      await sleep(Math.max(30, 210 / speed));
      if (chess.isCheck()) {
        sfx.play('check');
        const kg = chess.findPiece({ type: 'k', color: chess.turn() })[0];
        const ke = pieceEls.get(kg);
        if (ke) { ke.classList.add('checked'); setTimeout(() => ke.classList.remove('checked'), 900); }
      }
    }
  }

  if (outcome === 'timeout' && chess.isCheckmate()) {
    outcome = chess.turn() === ENEMY_COLOR ? 'win' : 'loss';
  }
  if (skipping) renderFinalPosition();

  const survivingValue = chess.board().flat()
    .filter(c => c && c.color === PLAYER_COLOR && c.type !== 'k')
    .reduce((s, c) => s + (VALUE[c.type] || 0), 0);

  await sleep(320);
  finishRound(outcome, plies, capturedValue, survivingValue, lastEval);
}

function renderFinalPosition() {
  $('#piece-layer').innerHTML = '';
  pieceEls.clear();
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell) placePieceEl({ type: cell.type, color: cell.color, square: cell.square });
    }
  }
}

// ===========================================================================
// Result
// ===========================================================================
const LOSS_LINE = {
  loss:    'Your king is down. That was not enough material.',
  draw:    'Neither fish nor fowl. A draw counts as a loss.',
  timeout: 'No mate inside the limit. Your fish just swam around.'
};

function finishRound(outcome, plies, capturedValue, survivingValue, finalEvalCp) {
  const res = game.finishRound(outcome, plies, { capturedValue, survivingValue, finalEvalCp });

  if (res.won) {
    sfx.play('mate');
    trophies.fire('roundWon', res);
    updateHud();
    if (game.phase === PHASE.WON) runComplete(res);
    else showPayout(res);
  } else {
    sfx.play('defeat');
    trophies.fire('roundLost', Object.assign({}, res, { reason: res.result }));
    updateHud();
    showRunOver(res);
  }
}

// The slot-machine moment: count the purse, then slam each multiplier on.
async function showPayout(res) {
  const pay = res.pay;
  const bg = modal(`
    <h2>MATE!</h2>
    <p>Your fish delivered in ${res.plies} of ${res.plyLimit} half-moves.</p>
    <ul class="payout-sheet" id="pay-sheet"></ul>
    <div class="modal-actions"><button class="big-btn hidden" id="m-next">CONTINUE</button></div>`);
  const sheet = bg.querySelector('#pay-sheet');
  const next = bg.querySelector('#m-next');

  const addRow = async (cls, label, value, note, delay = 380) => {
    const li = el('li', cls, `<span>${label}${note ? `<span class="pnote">${note}</span>` : ''}</span>
                              <span class="pv">${value}</span>`);
    sheet.appendChild(li);
    void li.offsetWidth;
    li.classList.add('in');
    await sleep(delay);
  };

  for (const l of pay.lines) {
    sfx.play('coin');
    await addRow('', l.label, '$' + l.value, '', 300);
  }
  sfx.play('uiClick');
  await addRow('', 'Subtotal', '$' + pay.subtotal, '', 340);

  for (const m of pay.mults) {
    const big = m.mult >= 1.5;
    sfx.play(big ? 'upgrade' : 'buy');
    await addRow('mult' + (big ? ' big' : ''), m.label, '×' + m.mult.toFixed(2), m.note, 620);
  }
  if (pay.refund) {
    sfx.play('coin');
    await addRow('', 'Scavenged back', '$' + pay.refund, '', 320);
  }
  sfx.play('mate');
  await addRow('total', 'PAYOUT', '$' + pay.total, '', 260);

  next.classList.remove('hidden');
  next.onclick = () => { sfx.play('uiClick'); bg.remove(); openShop(); };
}

function showRunOver(res) {
  const tier = fishTier(game.fishLevel);
  const won = game.history.filter(h => h.won).length;
  const bg = modal(`<div class="dead-card">
    <div class="dead-fish">${fishSvg(tier.art, { size: 260 })}</div>
    <h2>RUN OVER</h2>
    <p>${LOSS_LINE[res.result] || LOSS_LINE.loss}</p>
    <p style="font-size:15px;color:var(--ink-mid)">There are no second chances. That was the deal.</p>
    <ul class="tally">
      <li><span>Fights won</span><span>${won}</span></li>
      <li><span>Reached</span><span>wave ${game.wave}, fight ${game.round}</span></li>
      <li><span>Final fish</span><span>${tier.name} (skill ${game.fishLevel})</span></li>
      <li><span>Perks collected</span><span>${game.ownedPerks().reduce((s, p) => s + p.count, 0)}</span></li>
      <li class="big"><span>Earned in total</span><span>$${game.totalEarned}</span></li>
    </ul>
    <div class="modal-actions"><button class="big-btn" id="m-again">NEW RUN</button></div></div>`);
  bg.querySelector('#m-again').onclick = () => {
    sfx.play('uiClick');
    bg.remove();
    game.reset();
    trophies.fire('runStart', {});
    startRound();
  };
}

function runComplete(res) {
  sfx.play('mate');
  const bg = modal(`<div class="boss-card">
    <div class="boss-art">${fishSvg(fishTier(game.fishLevel).art, { size: 300 })}</div>
    <h2 style="font-size:52px">PRIME HALTS</h2>
    <p class="boss-taunt">It has nothing left to calculate.</p>
    <ul class="tally">
      <li><span>Fights won</span><span>${game.history.filter(h => h.won).length}</span></li>
      <li><span>Final payout</span><span>$${res.pay.total}</span></li>
      <li><span>Perks collected</span><span>${game.ownedPerks().reduce((s, p) => s + p.count, 0)}</span></li>
      <li><span>Final fish</span><span>${fishTier(game.fishLevel).name} (skill ${game.fishLevel})</span></li>
      <li class="big"><span>Earned in total</span><span>$${game.totalEarned}</span></li>
    </ul>
    <div class="modal-actions"><button class="big-btn" id="m-again">NEW RUN</button></div></div>`);
  bg.querySelector('#m-again').onclick = () => {
    bg.remove();
    game.reset();
    trophies.fire('runStart', {});
    startRound();
  };
}

// ===========================================================================
// Shop: THE LAB + THE BLACK MARKET
// ===========================================================================
function openShop() {
  game.phase = PHASE.SHOP;
  if (!game.offer.length) game.rollOffer();

  const bg = modal('', { wide: true });
  const box = bg.querySelector('.modal');

  const render = () => {
    const tier = fishTier(game.fishLevel);
    const next = nextFishTier(game.fishLevel);
    box.innerHTML = `
      <div class="shop-head">
        <h2>THE LAB</h2>
        <div class="shop-money">${COIN_SOLID}<b>${game.money}</b></div>
      </div>
      <p style="color:var(--ink-mid);font-size:15px">
        Your fish: <b>${tier.name}</b> — ${tier.line}
        ${next ? ` Next tier at skill ${next.lvl}: <b>${next.name}</b>.` : ''}</p>
      <div class="shop-grid">
        ${game.labItems().map(i => `
          <div class="shop-card ${game.money < i.cost ? 'broke' : ''}" data-lab="${i.id}">
            <div class="sc-ico">${icon(i.icon, { size: 34 })}</div>
            <div class="sc-body">
              <div class="sc-top"><span class="sc-name">${i.name}</span><span class="sc-cost">$${i.cost}</span></div>
              <div class="sc-value">${i.value}</div>
              <div class="sc-desc">${i.desc}</div>
            </div></div>`).join('')}
      </div>

      <h3>THE BLACK MARKET</h3>
      <div class="shop-grid">
        ${game.offer.length ? game.offer.map(p => `
          <div class="shop-card ${p.rarity} ${game.money < p.cost ? 'broke' : ''}" data-perk="${p.id}">
            <div class="sc-ico">${icon(p.icon, { size: 34 })}</div>
            <div class="sc-body">
              <div class="sc-top"><span class="sc-name">${p.name}</span><span class="sc-cost">$${p.cost}</span></div>
              <div class="sc-rarity">${RARITY[p.rarity].label}${game.perkCount(p.id) ? ` · owned ${game.perkCount(p.id)}/${p.max}` : ''}</div>
              <div class="sc-desc">${p.desc}</div>
            </div></div>`).join('')
          : '<div class="shop-empty">Sold out. Reroll for a fresh set.</div>'}
      </div>

      <div class="modal-actions">
        <button class="ghost-btn" id="m-reroll"${game.money < game.rerollPrice() ? ' disabled' : ''}>REROLL $${game.rerollPrice()}</button>
        <button class="big-btn" id="m-go">NEXT FIGHT</button>
      </div>`;

    box.querySelectorAll('[data-lab]').forEach(c => {
      c.onclick = () => {
        if (c.classList.contains('broke')) { sfx.play('error'); return; }
        const r = game.buyLab(c.dataset.lab);
        if (!r.ok) return;
        sfx.play(c.dataset.lab === 'fish' ? 'upgrade' : 'buy');
        trophies.fire('upgrade', { fishLevel: game.fishLevel });
        c.classList.add('bought');
        setTimeout(() => { render(); updateHud(); }, 240);
      };
    });

    box.querySelectorAll('[data-perk]').forEach(c => {
      c.onclick = () => {
        if (c.classList.contains('broke')) { sfx.play('error'); return; }
        const id = c.dataset.perk;
        const r = game.buyPerk(id);
        if (!r.ok) { sfx.play('error'); return; }
        sfx.play('upgrade');
        trophies.fire('perk', { perkCount: game.ownedPerks().reduce((s, p) => s + p.count, 0) });
        c.classList.add('bought');
        setTimeout(() => { render(); updateHud(); renderPerkChips(id); }, 240);
      };
    });

    box.querySelector('#m-reroll').onclick = () => {
      const r = game.reroll();
      if (!r.ok) { sfx.play('error'); return; }
      sfx.play('uiClick');
      render(); updateHud();
    };
    box.querySelector('#m-go').onclick = () => { sfx.play('uiClick'); bg.remove(); startRound(); };
  };
  render();
}

// ===========================================================================
// Start of a fight
// ===========================================================================
async function startRound() {
  const enemy = game.startRound();
  selectedType = null;
  skipping = false;
  setEval(null, null);

  $('#rail-left').classList.remove('hidden');
  $('#speed-row').classList.add('hidden');
  $('#btn-start').classList.remove('hidden');
  $('#verdict').classList.remove('hidden');

  const kind = $('#enemy-kind');
  kind.textContent = game.isBoss ? 'BOSS' : `SKIRMISH ${game.slot}/${SKIRMISHES_PER_WAVE}`;
  kind.classList.toggle('boss', !!game.isBoss);
  $('#enemy-name').textContent = enemy.theme.name;
  $('#enemy-blurb').textContent = enemy.theme.blurb;

  const modBox = $('#enemy-mod');
  if (game.isBoss && game.boss.modText) {
    modBox.textContent = game.boss.modText;
    modBox.classList.remove('hidden');
  } else {
    modBox.classList.add('hidden');
  }

  $('#status-text').textContent = defaultStatus();
  buildBoard();
  renderAllPieces();
  refreshPlacement();
  updateHud();
  trophies.fire('roundStart', { round: game.round, wave: game.wave, money: game.money });

  if (game.isBoss) await bossIntro(game.boss);
  if (game.roundBudget) { pulse('#dash-money'); sfx.play('coin'); }
}

// ===========================================================================
// Trophies + help
// ===========================================================================
function openTrophies() {
  const p = trophies.progress();
  const cards = ACHIEVEMENTS.map(a => {
    const got = trophies.unlocked.has(a.id);
    const secret = a.hidden && !got;
    return `<div class="trophy ${got ? 'tier' + a.tier : 'locked'}">
      <div class="tr-badge">${got ? TIER_ICON[a.tier] : '?'}</div>
      <div><div class="tr-name">${secret ? '???' : a.name}</div>
      <div class="tr-desc">${secret ? 'Secret. Go find it.' : a.desc}</div></div></div>`;
  }).join('');
  const bg = modal(`<h2 class="small">TROPHY CABINET <small style="font-size:19px">${p.done}/${p.total}</small></h2>
    <div class="trophy-grid">${cards}</div>
    <div class="modal-actions"><button class="ghost-btn" id="m-close">CLOSE</button></div>`,
    { dismissable: true, wide: true });
  bg.querySelector('#m-close').onclick = () => bg.remove();
}

function openHow() {
  const bg = modal(`
    <h2>HOW THIS WORKS</h2>
    <p><b>1. You never move.</b> Your engine plays. You only buy its army and place it
       on your half, ranks 5&ndash;8. You are Black.</p>
    <p><b>2. White always moves first</b> and is always Stockfish at full strength.
       You may threaten mate; White always gets to answer.</p>
    <p><b>3. Mate instinct.</b> However stupid your fish is, it never misses a forced
       mate that is really on the board. Everything else it will happily botch.</p>
    <p><b>4. One loss ends the run.</b> No lives, no retries. That is why the board
       tells you the multiplier and warns you about mate in one <em>before</em> you commit.</p>
    <h3>THE MULTIPLIERS</h3>
    <p><b>THRIFT</b> is the big one: the less material you bring over White, the more a
       win pays — up to <b>×3</b> if you win with <em>less</em> material than White.
       Overkill armies win easily and pay almost nothing.</p>
    <p><b>SPEED</b> pays up to ×1.5 for mating well inside the clock.
       <b>LOOT</b> pays for every enemy point you take.
       <b>SALVAGE</b> refunds half the value of every piece of yours still standing.</p>
    <p>So the whole game is one question: <em>how little can you get away with?</em></p>
    <div class="modal-actions"><button class="big-btn" id="m-ok">GOT IT</button></div>`,
    { dismissable: true });
  bg.querySelector('#m-ok').onclick = () => bg.remove();
}

// ===========================================================================
// Wiring
// ===========================================================================
$('#btn-start').onclick = () => {
  if (!$('#btn-start').disabled) { sfx.play('uiClick'); runSimulation(); }
};
$('#btn-clear').onclick = () => {
  sfx.play('sell'); game.clearBoard(); renderAllPieces(); refreshPlacement();
};
$('#btn-trophies').onclick = () => { sfx.play('uiClick'); openTrophies(); };
$('#btn-how').onclick = openHow;
$('#btn-how2').onclick = openHow;
$('#btn-sound').onclick = () => {
  const muted = sfx.toggle();
  $('#btn-sound').classList.toggle('off', muted);
  $('#btn-sound').textContent = muted ? '♪̸' : '♪';
  if (!muted) sfx.play('uiClick');
};
document.querySelectorAll('.spd').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.spd').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const s = +b.dataset.spd;
    if (s === 0) skipping = true; else { speed = s; skipping = false; }
  };
});

// ===========================================================================
// Boot
// ===========================================================================
(async function boot() {
  updateTrophyCount();
  if (sfx.muted) { $('#btn-sound').classList.add('off'); $('#btn-sound').textContent = '♪̸'; }

  const steps = [
    ['Defrosting fish...', 14],
    ['Loading Stockfish 18 (7 MB)...', 42],
    ['Teaching the opponent to be cruel...', 68],
    ['Waking the referee...', 88],
    ['Drawing the board...', 97]
  ];
  const setStep = i => {
    $('#boot-status').textContent = steps[i][0];
    $('#boot-bar-fill').style.width = steps[i][1] + '%';
  };

  try {
    setStep(0); await sleep(240);
    setStep(1); await myFish.boot();
    setStep(2); await foeFish.boot();
    setStep(3); await referee.boot();
    setStep(4); await sleep(160);
    $('#boot-bar-fill').style.width = '100%';
    $('#boot-status').textContent = 'The fish is awake. It does not look clever.';
    $('#btn-play').classList.remove('hidden');
    $('#btn-how').classList.remove('hidden');
    if (introSeen()) $('#btn-replay-intro').classList.remove('hidden');

    const launch = async (forceIntro) => {
      sfx.unlock();
      sfx.play('uiClick');
      $('#btn-play').disabled = true;
      await playIntro({ force: forceIntro });
      $('#boot').classList.add('hidden');
      $('#game').classList.remove('hidden');
      trophies.fire('runStart', {});
      startRound();
    };
    $('#btn-play').onclick = () => launch(false);
    $('#btn-replay-intro').onclick = () => launch(true);
  } catch (e) {
    $('#boot-status').innerHTML = `Engine failed to load: ${e.message}<br>
      <small>The page must be served over http(s), not opened as a file.</small>`;
    console.error(e);
  }
})();
