// Prozeduraler Gegner-Generator mit Themen. Deterministisch ueber Seed.
import { VALUE, buildFen, FILES, sq, PLAYER_KING_SQUARE } from './rules.js';
import { Chess, validateFen } from '../vendor/chess.js';

// --- Seeded RNG (mulberry32) --------------------------------------------
export function rng(seed) {
  // Seed erst durchmischen (splitmix32), sonst korrelieren die ERSTEN Ausgaben
  // benachbarter Seeds stark -> immer dasselbe Thema. Hat uns echt erwischt.
  let a = (seed >>> 0);
  a = Math.imul(a ^ (a >>> 16), 0x21f0aaad);
  a = Math.imul(a ^ (a >>> 15), 0x735a2d97);
  a = (a ^ (a >>> 15)) >>> 0;
  const next = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next(); next(); next(); // warmlaufen
  return next;
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// --- Themen --------------------------------------------------------------
// weight: Wahrscheinlichkeit. tier: ab welcher Runde verfuegbar.
// build(budget): gibt Figurenliste zurueck, die ungefaehr `budget` Materialwert hat.
export const THEMES = [
  {
    id: 'intern', name: 'THE INTERN', tier: 0, weight: 3,
    blurb: 'It brought the rulebook.',
    build: (b, r) => fill(b, ['p', 'p', 'p', 'n'], r)
  },
  {
    id: 'wall', name: 'THE WALL', tier: 0, weight: 4,
    blurb: 'Pawns. So many pawns.',
    build: (b, r) => fill(b, ['p', 'p', 'p', 'p', 'p', 'b'], r)
  },
  {
    id: 'cavalry', name: 'THE CAVALRY', tier: 1, weight: 3,
    blurb: 'Knights are hell for a stupid fish.',
    build: (b, r) => fill(b, ['n', 'n', 'p', 'n', 'p'], r)
  },
  {
    id: 'towers', name: 'THE TOWERS', tier: 1, weight: 3,
    blurb: 'Connected, patient, and very square.',
    build: (b, r) => fill(b, ['r', 'r', 'p', 'p', 'p'], r)
  },
  {
    id: 'bishops', name: 'THE BISHOP PAIR', tier: 1, weight: 3,
    blurb: 'Two diagonals, one problem.',
    build: (b, r) => fill(b, ['b', 'b', 'p', 'p', 'n'], r)
  },
  {
    id: 'hedgehog', name: 'THE HEDGEHOG', tier: 2, weight: 2,
    blurb: 'Compact, spiky, patient.',
    build: (b, r) => fill(b, ['p', 'p', 'p', 'p', 'n', 'b', 'r'], r)
  },
  {
    id: 'beast', name: 'THE BEAST', tier: 2, weight: 2,
    blurb: 'It has a queen. You have a problem.',
    build: (b, r) => fill(b, ['q', 'p', 'p', 'p'], r)
  },
  {
    id: 'swarm', name: 'THE SWARM', tier: 3, weight: 2,
    blurb: 'Everything at once, none of it good.',
    build: (b, r) => fill(b, ['n', 'b', 'r', 'p', 'n', 'b', 'p', 'p'], r)
  },
  {
    id: 'court', name: 'THE COURT', tier: 4, weight: 2,
    blurb: 'A queen, a rook, and a bad mood.',
    build: (b, r) => fill(b, ['q', 'r', 'b', 'p', 'p', 'p'], r)
  }
];

// Fuellt bis Budget erreicht ist, zyklisch durch das Rezept.
function fill(budget, recipe, r) {
  const out = [];
  let spent = 0, i = 0, guard = 0;
  while (spent < budget && guard++ < 64) {
    const t = recipe[i % recipe.length];
    i++;
    if (spent + VALUE[t] > budget + 1) {
      // passt nicht mehr -> versuche billigere Figur
      if (spent + 1 <= budget + 1 && VALUE.p <= budget - spent + 1) { out.push('p'); spent += 1; continue; }
      break;
    }
    out.push(t); spent += VALUE[t];
  }
  // Max 15 Nicht-Koenig-Figuren, max 8 Bauern
  const pawns = out.filter(x => x === 'p');
  const rest = out.filter(x => x !== 'p');
  return [...rest.slice(0, 7), ...pawns.slice(0, 8)];
}

// --- Platzierung ---------------------------------------------------------
// Gegner ist WEISS und steht auf Reihe 1-4. Koenig auf Reihe 1.
function placeEnemy(types, r) {
  const used = new Set();
  const pieces = [];
  const take = (cands) => {
    const free = cands.filter(s => !used.has(s));
    if (!free.length) return null;
    const s = pick(r, free);
    used.add(s);
    return s;
  };

  // Koenig zuerst: bevorzugt "rochiert" wirkende Ecken
  const kingSq = take(['b1', 'c1', 'g1', 'h1', 'e1', 'd1', 'a1', 'f1']);
  pieces.push({ type: 'k', color: 'w', square: kingSq });

  const rank1 = FILES.map(f => f + '1');
  const rank2 = FILES.map(f => f + '2');
  const rank3 = FILES.map(f => f + '3');
  const rank4 = FILES.map(f => f + '4');

  for (const t of types) {
    let s = null;
    if (t === 'p') {
      s = take([...rank2, ...rank3]) || take(rank4);
    } else if (t === 'r') {
      s = take([...rank1, ...rank2]);
    } else {
      s = take([...rank2, ...rank1, ...rank3]) || take(rank4);
    }
    if (s) pieces.push({ type: t, color: 'w', square: s });
  }
  return pieces;
}

// --- Legalitaets-Check ---------------------------------------------------
export function kingsAdjacent(a, b) {
  const fa = a.charCodeAt(0), ra = +a[1], fb = b.charCodeAt(0), rb = +b[1];
  return Math.abs(fa - fb) <= 1 && Math.abs(ra - rb) <= 1;
}

// --- Hauptfunktion -------------------------------------------------------
// Eine Gegnerstellung ist nur brauchbar, wenn sie auf dem sonst leeren Brett
// den Spielerkoenig NICHT schon angreift. Sonst startet der Spieler im Schach
// (oder gleich matt) und die Platzierungsphase ist reine Schadensbegrenzung.
export function enemySetupIsSane(pieces) {
  const withKing = [...pieces, { type: 'k', color: 'b', square: PLAYER_KING_SQUARE }];
  const fen = buildFen(withKing, 'w');
  if (!validateFen(fen).ok) return false;
  let c;
  try { c = new Chess(fen); } catch (e) { return false; }
  // Weiss ist am Zug, also darf SCHWARZ (du) nicht im Schach stehen.
  if (c.isAttacked(PLAYER_KING_SQUARE, 'w')) return false;
  // Weiss darf nicht schon feststecken -- sonst ist die Runde vorbei bevor sie anfaengt.
  if (c.moves().length === 0) return false;
  return true;
}

export function generateEnemy(round, seed) {
  const tier = Math.min(4, Math.floor((round - 1) / 3));
  const pool = THEMES.filter(t => t.tier <= tier);
  const bag = [];
  for (const t of pool) for (let i = 0; i < t.weight; i++) bag.push(t);
  const budget = enemyMaterialForRound(round);

  let last = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const r = rng(seed * 7919 + round * 104729 + attempt * 2654435761 + 13);
    const theme = pick(r, bag);
    const types = theme.build(budget, r);
    const pieces = placeEnemy(types, r);
    last = {
      theme: { id: theme.id, name: theme.name, blurb: theme.blurb },
      pieces,
      material: pieces.reduce((s, p) => s + (VALUE[p.type] || 0), 0),
      round, attempts: attempt + 1
    };
    if (enemySetupIsSane(pieces)) return last;
  }
  // Notbremse: alle schlagenden Linien auf e1 raeumen
  last.pieces = last.pieces.filter(p => p.type === 'k' || p.square[0] !== 'e');   // e-Linie raeumen
  last.material = last.pieces.reduce((s, p) => s + (VALUE[p.type] || 0), 0);
  return last;
}

// Gegner-Material pro Runde. Bewusst flach am Anfang.
// Bewusst SEHR flach am Anfang: mit Fisch-Level 0 spielt deine Seite grauenhaft,
// da muss der Gegner fast nichts koennen. Ab Runde 6 zieht die Kurve an.
export function enemyMaterialForRound(round) {
  const table = [0, 2, 3, 5, 7, 9, 12, 15, 18, 21, 24, 28, 32, 36, 40, 44];
  if (round < table.length) return table[round];
  return 44 + (round - table.length + 1) * 4;
}

export function enemyFen(enemy, playerPieces = []) {
  return buildFen([...enemy.pieces, ...playerPieces], 'w');
}
