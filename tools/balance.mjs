// Miss experimentell: Wieviel Materialvorsprung braucht Skill-Level S,
// um Skill 20 innerhalb von PLY_LIMIT Halbzuegen mattzusetzen?
import { createRequire } from 'module';
import { Chess } from '../vendor/chess.js';
import { generateEnemy } from '../js/generator.js';
import { buildFen } from '../js/rules.js';
import { referenceBuild, materialOf } from './autobuild.mjs';

const require = createRequire(import.meta.url);
const { createUci } = require('./uci.cjs');
const BIN = new URL('../vendor/stockfish/stockfish-18-lite-single.js', import.meta.url).pathname;

const PLY_LIMIT = +(process.env.PLY || 40);
const MOVETIME = +(process.env.MT || 100);

export async function makeEngines() {
  const me = createUci(BIN), foe = createUci(BIN);
  await Promise.all([me.init(), foe.init()]);
  return { me, foe, quit() { me.quit(); foe.quit(); } };
}

// engines optional: wiederverwendbar, damit wir nicht pro Partie zwei
// WASM-Prozesse starten (das hat den Rechner ueberfahren und stumme
// "bestmove"-Ausfaelle produziert, die wie Niederlagen aussahen).
export async function playMatch(enemy, playerPieces, skill, { plyLimit = PLY_LIMIT, movetime = MOVETIME, engines = null } = {}) {
  const own = !engines;
  if (own) engines = await makeEngines();
  const { me, foe } = engines;
  await Promise.all([me.newGame(), foe.newGame()]);
  const fen = buildFen([...enemy.pieces, ...playerPieces], 'w');
  let chess;
  try { chess = new Chess(fen); } catch (e) { if (own) engines.quit(); return { result: 'illegal', reason: e.message, plies: 0 }; }

  let plies = 0, result = 'timeout';
  while (plies < plyLimit) {
    if (chess.isGameOver()) {
      // Spieler ist SCHWARZ -> Sieg wenn Weiss matt ist
      result = chess.isCheckmate() ? (chess.turn() === 'w' ? 'win' : 'loss') : 'draw';
      break;
    }
    const mine = chess.turn() === 'b';
    const eng = mine ? me : foe;
    const r = await eng.search(chess.fen(), { skill: mine ? skill : 20, movetime });
    if (!r.move || r.move === '(none)') {
      // Kein Zug obwohl legale Zuege existieren = Engine-Ausfall, keine Niederlage.
      result = chess.moves().length ? 'engine-dropout' : (mine ? 'loss' : 'win');
      break;
    }
    try { chess.move(r.move, { strict: false }); } catch (e) {
      try { chess.move({ from: r.move.slice(0,2), to: r.move.slice(2,4), promotion: r.move[4] || 'q' }); }
      catch (e2) { result = 'engine-error'; break; }
    }
    plies++;
  }
  if (result === 'timeout' && chess.isCheckmate()) result = chess.turn() === 'w' ? 'win' : 'loss';
  if (own) engines.quit();
  return { result, plies, fen };
}

async function main() {
  const skills = (process.env.SKILLS || '0,4,8,12,16,20').split(',').map(Number);
  const advs = (process.env.ADVS || '3,7,12,18,26').split(',').map(Number);
  const enemy = generateEnemy(5, 42);
  console.log(`Gegner: ${enemy.theme.name}  Material=${enemy.material}  PLY_LIMIT=${PLY_LIMIT} movetime=${MOVETIME}ms`);
  console.log('skill | ' + advs.map(a => ('+' + a).padStart(6)).join(' '));
  for (const s of skills) {
    const row = [];
    for (const a of advs) {
      const build = referenceBuild(enemy.material + a);
      const t = Date.now();
      const r = await playMatch(enemy, build, s);
      row.push(`${r.result[0].toUpperCase()}${String(r.plies).padStart(2)}`.padStart(6));
      process.stderr.write(`  s=${s} adv=+${a} -> ${r.result} in ${r.plies} (${((Date.now()-t)/1000).toFixed(1)}s)\n`);
    }
    console.log(String(s).padStart(5) + ' | ' + row.join(' '));
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main().then(()=>process.exit(0));
