import { Chess } from '../vendor/chess.js';
import { CONFIG } from './config.js';
import { COST, PIECE_NAME, fishRank, FILES, PLAYER_KING_SQUARE, PLAYER_COLOR, ENEMY_COLOR, PLAYER_ZONE } from './rules.js';
import { Game, PHASE } from './game.js';
import { Engine } from './engine.js';
import { AchievementTracker, ACHIEVEMENTS } from './achievements.js';
import { ROUGH_DEFS, pieceSvg, FISH_SVG } from './art.js';

const $ = s => document.querySelector(s);
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

document.getElementById('rough-defs').innerHTML = ROUGH_DEFS;
$('#boot-fish').innerHTML = FISH_SVG;

// ===========================================================================
// Zustand
// ===========================================================================
const game = new Game();
const myFish = new Engine('fisch');
const foeFish = new Engine('gegner');
const trophies = new AchievementTracker(a => showToast(a));

let selectedType = null;
let speed = 2;
let skipping = false;
let chess = null;
const pieceEls = new Map();   // feld -> element

// ===========================================================================
// Achievement-Toast: knallt rein wie ein Stempel
// ===========================================================================
const TIER_ICON = { 1: '●', 2: '◆', 3: '★' };
function showToast(a) {
  const t = el('div', `toast tier${a.tier}`);
  t.innerHTML = `
    <div class="rays">${Array.from({ length: 10 }, (_, i) =>
      `<i style="transform:rotate(${i * 36}deg) translateY(-14px);animation-delay:${i * 18}ms"></i>`).join('')}</div>
    <div class="t-badge">${TIER_ICON[a.tier]}</div>
    <div>
      <div class="t-kicker">Freigeschaltet</div>
      <div class="t-name">${a.name}</div>
      <div class="t-desc">${a.desc}</div>
    </div>`;
  $('#toast-root').appendChild(t);
  setTimeout(() => { t.querySelector('.rays')?.remove(); }, 800);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 420); }, 4600);
  updateTrophyCount();
}
function updateTrophyCount() {
  const p = trophies.progress();
  $('#trophy-count').textContent = `${p.done}/${p.total}`;
}

// ===========================================================================
// Modal
// ===========================================================================
function modal(html, { dismissable = false } = {}) {
  const bg = el('div', 'modal-bg');
  bg.innerHTML = `<div class="modal">${html}</div>`;
  if (dismissable) bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
  $('#modal-root').appendChild(bg);
  return bg;
}

// ===========================================================================
// Brett
// ===========================================================================
// Brett aus SCHWARZER Sicht: Reihe 1 oben, Reihe 8 unten, h-Linie links.
// Deine Haelfte liegt damit unten, wo sie hingehoert.
function squareToXY(sq) {
  const f = 7 - (sq.charCodeAt(0) - 97);
  const r = parseInt(sq[1], 10) - 1;
  return { f, r };
}
function buildBoard() {
  const b = $('#board');
  b.innerHTML = '';
  for (let r = 1; r <= 8; r++) {
    for (const f of [...FILES].reverse()) {
      const sq = f + r;
      const d = el('div', 'sq' + (((f.charCodeAt(0) - 97) + r) % 2 === 0 ? ' dark' : ''));
      d.dataset.square = sq;
      if (r >= PLAYER_ZONE[0]) d.classList.add('zone');
      if (f === 'h') d.appendChild(el('span', 'sq-coord', String(r)));
      if (r === 8) d.appendChild(el('span', 'sq-coord', f));
      b.appendChild(d);
    }
  }
  b.onclick = onBoardClick;
}

function placePieceEl(piece, { animate = false } = {}) {
  const e = el('div', 'pc' + (piece.color === PLAYER_COLOR ? ' mine' : '') + (animate ? ' placing' : ''));
  e.innerHTML = pieceSvg(piece.type, piece.color);
  e.dataset.square = piece.square;
  e.dataset.type = piece.type;
  e.dataset.color = piece.color;
  const { f, r } = squareToXY(piece.square);
  e.style.transform = `translate(calc(${f} * var(--cell)), calc(${r} * var(--cell)))`;
  if (piece.color === PLAYER_COLOR && piece.square !== PLAYER_KING_SQUARE) {
    e.addEventListener('click', ev => { ev.stopPropagation(); if (game.phase === PHASE.PLACE) sellAt(piece.square); });
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

// Wendet einen chess.js-Zug auf die DOM-Figuren an.
function animateMove(mv) {
  const fromEl = pieceEls.get(mv.from);
  if (!fromEl) return;

  if (mv.captured) {
    const capSq = mv.flags.includes('e')
      ? mv.to[0] + mv.from[1]           // en passant: Bauer steht woanders
      : mv.to;
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
  if (mv.promotion) {
    setTimeout(() => { fromEl.innerHTML = pieceSvg(mv.promotion, mv.color); fromEl.classList.add('placing'); }, 190);
  }
  pieceEls.set(mv.to, fromEl);

  document.querySelectorAll('.sq.lastmove').forEach(s => s.classList.remove('lastmove'));
  document.querySelector(`.sq[data-square="${mv.from}"]`)?.classList.add('lastmove');
  document.querySelector(`.sq[data-square="${mv.to}"]`)?.classList.add('lastmove');
}

// ===========================================================================
// Platzierungsphase
// ===========================================================================
function renderShop() {
  const wrap = $('#shop-pieces');
  wrap.innerHTML = '';
  for (const type of ['p', 'n', 'b', 'r', 'q']) {
    const price = game.priceOf(type);
    const broke = game.money < price;
    const item = el('div', 'shop-item' + (broke ? ' broke' : '') + (selectedType === type ? ' selected' : ''));
    item.innerHTML = `<div class="si-icon">${pieceSvg(type, PLAYER_COLOR, { size: 34 })}</div>
                      <div class="si-name">${PIECE_NAME[type]}</div>
                      <div class="si-price">${price}$</div>`;
    item.onclick = () => {
      if (broke) { flashStatus('Dafuer reicht das Geld nicht.'); return; }
      selectedType = selectedType === type ? null : type;
      renderShop(); markPlaceable();
    };
    wrap.appendChild(item);
  }
  $('#budget-note').textContent = selectedType
    ? `${PIECE_NAME[selectedType]} gewaehlt - klick auf ein Feld.`
    : 'Figur waehlen, dann Feld anklicken. Klick auf eine eigene Figur verkauft sie.';
}

function markPlaceable() {
  const occ = game.occupied();
  const forbidden = selectedType ? game.forbiddenSquares(selectedType) : new Set();
  document.querySelectorAll('.sq').forEach(s => {
    s.classList.remove('can-place', 'hint');
    const sq = s.dataset.square;
    const rank = +sq[1];
    if (game.phase !== PHASE.PLACE) return;
    if (rank < PLAYER_ZONE[0] || occ.has(sq)) return;
    if (selectedType === 'p' && rank === 8) return;
    if (forbidden.has(sq)) return;          // von dort waere es sofort Schach
    if (selectedType) { s.classList.add('can-place', 'hint'); }
  });
}

function onBoardClick(ev) {
  if (game.phase !== PHASE.PLACE) return;
  const sq = ev.target.closest('.sq')?.dataset.square;
  if (!sq || !selectedType) return;
  const r = game.buy(selectedType, sq);
  if (!r.ok) {
    flashStatus(r.msg);
    if (r.msg.includes('matt oder patt')) trophies.fire('illegalSetup', { reason: 'instantwin' });
    return;
  }
  placePieceEl({ type: selectedType, color: PLAYER_COLOR, square: sq }, { animate: true });
  if (game.money < game.priceOf(selectedType)) selectedType = null;
  refreshPlacementUI();
}

function sellAt(sq) {
  const r = game.sell(sq);
  if (!r.ok) return;
  const e = pieceEls.get(sq);
  if (e) { e.classList.add('dying'); pieceEls.delete(sq); setTimeout(() => e.remove(), 300); }
  refreshPlacementUI();
}

function refreshPlacementUI() {
  renderShop(); markPlaceable(); updateHud();
  const v = game.validate();
  const edge = game.materialEdge();
  $('#material-val').textContent = (edge >= 0 ? '+' : '') + edge;
  $('#plies-val').textContent = Math.floor(game.plyLimit / 2) + ' Zuege';
  $('#eval-val').textContent = '...';

  const verdict = $('#verdict');
  const start = $('#btn-start');
  if (!v.ok) {
    verdict.className = 'verdict bad';
    verdict.textContent = v.msg;
    start.disabled = true;
  } else if (game.placed.length === 0) {
    verdict.className = 'verdict';
    verdict.textContent = 'Nur dein Koenig steht da. Das wird nichts.';
    start.disabled = true;
  } else {
    verdict.className = 'verdict';
    verdict.textContent = advice(edge);
    start.disabled = false;
  }
}

function advice(edge) {
  const need = game.requiredEdge() / 100;
  const ratio = edge / Math.max(1, need);
  if (ratio < 0.55) return `Dein Fisch ist zu schwach fuer so wenig Material. Kauf nach.`;
  if (ratio < 0.95) return `Knapp. Koennte reichen, koennte auch peinlich werden.`;
  if (ratio < 1.9)  return `Solide. Das sollte dein Fisch hinkriegen.`;
  return `Ueppig. Schoen - aber das Geld fehlt dir naechste Runde.`;
}

let statusTimer;
function flashStatus(msg) {
  const t = $('#status-text');
  t.textContent = msg; t.classList.add('warn');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { t.classList.remove('warn'); t.textContent = defaultStatus(); }, 2200);
}
function defaultStatus() {
  if (game.phase === PHASE.PLACE) return 'Stell deine Armee auf. Reihe 5 bis 8. Weiss zieht zuerst.';
  if (game.phase === PHASE.SIM) return 'Die Fische spielen. Du guckst.';
  return '';
}

// ===========================================================================
// HUD
// ===========================================================================
function pulse(sel) { const e = $(sel); e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); }
function updateHud() {
  $('#stat-round').querySelector('b').textContent = game.round;
  $('#stat-money').querySelector('b').textContent = game.money + '$';
  const rank = fishRank(game.fishLevel);
  const f = $('#stat-fish');
  f.querySelector('b').textContent = rank.name;
  f.querySelector('small').textContent = 'Lvl ' + game.fishLevel;
  const h = $('#stat-hearts').querySelector('b');
  const slots = Math.max(CONFIG.START_HEARTS, game.hearts);
  h.innerHTML = Array.from({ length: slots },
    (_, i) => `<span class="heart${i < game.hearts ? '' : ' gone'}">&#9829;</span>`).join('');
  trophies.fire('money', { money: game.money });
}

// ===========================================================================
// Simulation
// ===========================================================================
async function runSimulation() {
  game.phase = PHASE.SIM;
  const v = game.validate();
  chess = new Chess(v.fen);

  $('#rail-left').classList.add('hidden');
  $('#speed-row').classList.remove('hidden');
  $('#btn-start').classList.add('hidden');
  $('#status-text').textContent = 'Die Fische spielen. Du guckst.';
  document.querySelectorAll('.sq').forEach(s => s.classList.remove('can-place', 'hint', 'zone'));

  await Promise.all([myFish.newGame(), foeFish.newGame()]);

  let plies = 0, outcome = 'timeout';
  while (plies < game.plyLimit) {
    if (chess.isGameOver()) {
      // Du bist Schwarz: du gewinnst, wenn WEISS matt ist.
      if (chess.isCheckmate()) outcome = chess.turn() === ENEMY_COLOR ? 'win' : 'loss';
      else outcome = 'draw';
      break;
    }
    const mine = chess.turn() === PLAYER_COLOR;
    const eng = mine ? myFish : foeFish;
    // Denkzeit bleibt IMMER gleich -- Tempo aendert nur die Anzeige,
    // sonst wuerde der Zuschauer die Spielstaerke verstellen.
    const r = await eng.search(chess.fen(), {
      skill: mine ? game.fishLevel : 20,
      movetime: mine ? CONFIG.MOVETIME_PLAYER : CONFIG.MOVETIME_ENEMY
    });
    if (!r.move) { outcome = chess.moves().length ? 'draw' : (mine ? 'loss' : 'win'); break; }

    if (mine && !skipping) showEval(r);
    let mv;
    try { mv = chess.move(r.move, { strict: false }); }
    catch (e) {
      try { mv = chess.move({ from: r.move.slice(0, 2), to: r.move.slice(2, 4), promotion: r.move[4] || 'q' }); }
      catch (e2) { outcome = 'draw'; break; }
    }
    plies++;

    if (!skipping) {
      animateMove(mv);
      $('#plies-val').textContent = `${Math.ceil((game.plyLimit - plies) / 2)} Zuege`;
      await sleep(Math.max(30, 210 / speed));
      if (chess.isCheck()) {
        const kg = chess.findPiece({ type: 'k', color: chess.turn() })[0];
        const ke = pieceEls.get(kg);
        if (ke) { ke.classList.add('checked'); setTimeout(() => ke.classList.remove('checked'), 900); }
      }
    }
  }
  if (outcome === 'timeout' && chess.isCheckmate()) outcome = chess.turn() === ENEMY_COLOR ? 'win' : 'loss';

  if (skipping) { renderFinalPosition(); }
  await sleep(360);
  finishRound(outcome, plies);
}

function showEval(r) {
  const box = $('#eval-val');
  if (r.mate != null) box.textContent = r.mate > 0 ? `Matt in ${r.mate}` : `Matt in ${-r.mate} gegen dich`;
  else if (r.cp != null) box.textContent = (r.cp >= 0 ? '+' : '') + (r.cp / 100).toFixed(1);
  else box.textContent = '...';
}

function renderFinalPosition() {
  $('#piece-layer').innerHTML = ''; pieceEls.clear();
  for (const row of chess.board()) for (const cell of row) {
    if (cell) placePieceEl({ type: cell.type, color: cell.color, square: cell.square });
  }
}

// ===========================================================================
// Rundenende
// ===========================================================================
const OUTCOME_TEXT = {
  win:     { title: 'MATT!', line: 'Dein Fisch hat geliefert.' },
  loss:    { title: 'VERLOREN', line: 'Dein Koenig liegt. Das war zu wenig Material.' },
  draw:    { title: 'REMIS?!', line: 'Weder Fisch noch Fleisch. Zaehlt als Niederlage.' },
  timeout: { title: 'ZEIT UM', line: 'Kein Matt im Limit. Dein Fisch hat rumgeschwommen.' }
};

function finishRound(outcome, plies) {
  const res = game.finishRound(outcome, plies);
  const t = OUTCOME_TEXT[outcome] || OUTCOME_TEXT.timeout;

  if (res.won) trophies.fire('roundWon', res);
  else { trophies.fire('heartLost', {}); trophies.fire('roundLost', { ...res, reason: outcome }); }

  updateHud();
  if (!res.won) {
    const hs = $('#stat-hearts').querySelectorAll('.heart');
    const lost = hs[game.hearts];
    if (lost) lost.classList.add('breaking');
  }

  const rows = res.won
    ? `<li><span>Eingesetzt</span><span>${res.spent}$</span></li>
       <li><span>Halbzuege</span><span>${res.plies} / ${res.plyLimit}</span></li>
       <li><span>Preisgeld</span><span>+${res.income}$</span></li>
       <li class="big"><span>Kasse</span><span>${game.money}$</span></li>`
    : `<li><span>Verbrannt</span><span>${res.spent}$</span></li>
       <li><span>Halbzuege</span><span>${res.plies} / ${res.plyLimit}</span></li>
       <li class="big"><span>Leben uebrig</span><span>${game.hearts}</span></li>`;

  const over = game.hearts <= 0;
  const bg = modal(`
    <h2>${over ? 'AUS DIE MAUS' : t.title}</h2>
    <p>${over ? 'Keine Leben mehr. Dein Fisch schwimmt heim.' : t.line}</p>
    <ul class="tally">${rows}</ul>
    ${over ? `<p>Du bist bis <b>Runde ${game.round}</b> gekommen, mit einem <b>${fishRank(game.fishLevel).name}</b>.</p>` : ''}
    <div class="modal-actions">
      <button class="big-btn" id="m-next">${over ? 'NOCHMAL' : 'WEITER'}</button>
    </div>`);
  bg.querySelector('#m-next').onclick = () => {
    bg.remove();
    if (over) { game.reset(); trophies.fire('runStart', {}); startRound(); }
    else openShop();
  };
}

// ===========================================================================
// Shop zwischen den Runden
// ===========================================================================
function openShop() {
  game.phase = PHASE.SHOP;
  const render = () => {
    const items = game.shopItems();
    const rank = fishRank(game.fishLevel);
    const next = fishRank(Math.min(20, game.fishLevel + 1));
    return `
      <h2>DER LADEN</h2>
      <p>Kasse: <b>${game.money}$</b> &nbsp;&middot;&nbsp; Dein Fisch: <b>${rank.name}</b> (Lvl ${game.fishLevel})<br>
      <small style="color:var(--ink-soft)">${rank.desc}</small></p>
      <div class="shop-grid">
        ${items.map(i => `
          <div class="shop-card ${game.money < i.cost ? 'broke' : ''}" data-id="${i.id}">
            <div class="sc-top"><span class="sc-name">${i.name}</span><span class="sc-cost">${i.cost}$</span></div>
            <div class="sc-desc">${i.desc}${i.id === 'fish' && next.name !== rank.name ? ` <b>Wird zum ${next.name}.</b>` : ''}</div>
          </div>`).join('')}
      </div>
      <p style="font-size:15px;color:var(--ink-soft)">Was du hier ausgibst, fehlt dir gleich beim Figurenkauf.
      Was du sparst, nimmst du mit.</p>
      <div class="modal-actions"><button class="big-btn" id="m-go">NAECHSTE RUNDE</button></div>`;
  };

  const bg = modal(render());
  const wire = () => {
    bg.querySelectorAll('.shop-card').forEach(card => {
      card.onclick = () => {
        if (card.classList.contains('broke')) return;
        const r = game.buyShop(card.dataset.id);
        if (!r.ok) return;
        trophies.fire('upgrade', { fishLevel: game.fishLevel });
        card.classList.add('bought');
        setTimeout(() => { bg.querySelector('.modal').innerHTML = render(); wire(); updateHud(); }, 260);
      };
    });
    bg.querySelector('#m-go').onclick = () => { bg.remove(); startRound(); };
  };
  wire();
}

// ===========================================================================
// Rundenstart
// ===========================================================================
function startRound() {
  const enemy = game.startRound();
  selectedType = null; skipping = false;
  $('#rail-left').classList.remove('hidden');
  $('#speed-row').classList.add('hidden');
  $('#btn-start').classList.remove('hidden');
  $('#enemy-name').textContent = enemy.theme.name;
  $('#enemy-blurb').textContent = enemy.theme.blurb;
  $('#status-text').textContent = defaultStatus();
  buildBoard();
  renderAllPieces();
  refreshPlacementUI();
  updateHud();
  trophies.fire('roundStart', { round: game.round, money: game.money });
}

// ===========================================================================
// Pokal-Galerie
// ===========================================================================
function openTrophies() {
  const p = trophies.progress();
  const cards = ACHIEVEMENTS.map(a => {
    const got = trophies.unlocked.has(a.id);
    const secret = a.hidden && !got;
    return `<div class="trophy ${got ? 'tier' + a.tier : 'locked'}">
      <div class="tr-badge">${got ? TIER_ICON[a.tier] : '?'}</div>
      <div><div class="tr-name">${secret ? '???' : a.name}</div>
           <div class="tr-desc">${secret ? 'Geheim. Finde es selbst.' : a.desc}</div></div>
    </div>`;
  }).join('');
  const bg = modal(`<h2 class="small">POKALSCHRANK <small style="font-size:20px">${p.done}/${p.total}</small></h2>
    <div class="trophy-grid">${cards}</div>
    <div class="modal-actions"><button class="ghost-btn" id="m-close">ZU</button></div>`, { dismissable: true });
  bg.querySelector('#m-close').onclick = () => bg.remove();
}

// ===========================================================================
// Anleitung
// ===========================================================================
function openHow() {
  const bg = modal(`
    <h2>WIE DAS LAEUFT</h2>
    <p><b>1. Du spielst nicht.</b> Dein Fisch spielt. Du kaufst nur seine Armee und stellst sie
       auf deine Haelfte (Reihe 5 bis 8). Du bist Schwarz.</p>
    <p><b>2. Weiss zieht zuerst</b> und ist immer maximal stark - Stockfish auf Skill 20, ohne Ausnahme.
       Du darfst Matt drohen, aber Weiss darf sich immer wehren.</p>
    <p><b>3. Dein Fisch faengt bei Skill 0 an</b> und ist eine Katastrophe. Was ihm an Koennen fehlt, musst du
       mit Material ausgleichen. Material kostet Geld.</p>
    <p><b>4. Du gewinnst nur durch Matt</b>, und nur innerhalb des Zuglimits. Kein Matt = Herz weg.</p>
    <p><b>5. Uebriges Geld nimmst du mit.</b> Darum geht es: die Stellung so <em>billig</em> wie moeglich gewinnen,
       um den Fisch fuettern zu koennen. Ein besserer Fisch braucht weniger Material. Weniger Material spart Geld.
       Mehr Geld macht einen besseren Fisch.</p>
    <div class="modal-actions"><button class="big-btn" id="m-ok">KAPIERT</button></div>`, { dismissable: true });
  bg.querySelector('#m-ok').onclick = () => bg.remove();
}

// ===========================================================================
// Start
// ===========================================================================
$('#btn-start').onclick = () => { if (!$('#btn-start').disabled) runSimulation(); };
$('#btn-clear').onclick = () => { game.clearBoard(); renderAllPieces(); refreshPlacementUI(); };
$('#btn-trophies').onclick = openTrophies;
$('#btn-how').onclick = openHow;
document.querySelectorAll('.spd').forEach(b => b.onclick = () => {
  document.querySelectorAll('.spd').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  const s = +b.dataset.spd;
  if (s === 0) { skipping = true; } else { speed = s; skipping = false; }
});

(async function boot() {
  updateTrophyCount();
  const steps = [
    ['Fisch wird aufgetaut...', 18],
    ['Stockfish 18 wird geladen (7 MB)...', 45],
    ['Gegner-Engine wird boese gemacht...', 78],
    ['Brett wird gezeichnet...', 96]
  ];
  const setStep = i => {
    $('#boot-status').textContent = steps[i][0];
    $('#boot-bar-fill').style.width = steps[i][1] + '%';
  };
  try {
    setStep(0); await sleep(280);
    setStep(1); await myFish.boot();
    setStep(2); await foeFish.boot();
    setStep(3); await sleep(200);
    $('#boot-bar-fill').style.width = '100%';
    $('#boot-status').textContent = 'Fisch ist wach. Er wirkt nicht klug.';
    $('#btn-play').classList.remove('hidden');
    $('#btn-how').classList.remove('hidden');
    $('#btn-play').onclick = () => {
      $('#boot').classList.add('hidden');
      $('#game').classList.remove('hidden');
      trophies.fire('runStart', {});
      startRound();
    };
  } catch (e) {
    $('#boot-status').innerHTML = `Engine laedt nicht: ${e.message}<br>
      <small>Die Seite muss ueber http(s) laufen, nicht per Doppelklick auf die Datei.</small>`;
    console.error(e);
  }
})();
