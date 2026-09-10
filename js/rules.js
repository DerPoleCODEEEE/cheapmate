// Reine Spielregeln & Werte. Keine DOM-Abhaengigkeit -> in Node testbar.

export const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };

// Ladenpreise. Bewusst NICHT identisch mit dem Materialwert:
// Bauern sind relativ teuer (sie sind fuer eine schwache Engine schwer zu nutzen),
// Dame ist relativ guenstig (sie gewinnt auch mit dummem Fisch).
export const COST = { p: 2, n: 5, b: 5, r: 8, q: 13 };

export const PIECE_NAME = {
  p: 'Bauer', n: 'Springer', b: 'Laeufer', r: 'Turm', q: 'Dame', k: 'Koenig'
};

// Rang deines Fisches je Stockfish Skill Level (0-20)
export const FISH_RANKS = [
  { lvl: 0,  name: 'FISCHSTAEBCHEN', desc: 'Es ist nicht mal ein ganzer Fisch.' },
  { lvl: 2,  name: 'SARDINE',        desc: 'Klein. Salzig. Haengt Figuren ein.' },
  { lvl: 4,  name: 'HERING',         desc: 'Sieht Matt in eins. Manchmal.' },
  { lvl: 6,  name: 'MAKRELE',        desc: 'Hat von Entwicklung gehoert.' },
  { lvl: 8,  name: 'FORELLE',        desc: 'Faengt an, Gabeln zu bemerken.' },
  { lvl: 10, name: 'KARPFEN',        desc: 'Solide. Langweilig. Effektiv.' },
  { lvl: 12, name: 'LACHS',          desc: 'Schwimmt jetzt flussaufwaerts.' },
  { lvl: 14, name: 'THUNFISCH',      desc: 'Rechnet tief. Riecht streng.' },
  { lvl: 16, name: 'SCHWERTFISCH',   desc: 'Spitz. Gefaehrlich. Teuer.' },
  { lvl: 18, name: 'BARRAKUDA',      desc: 'Du willst nicht dagegen spielen.' },
  { lvl: 19, name: 'HAI',            desc: 'Riecht Blut ab drei Bauern.' },
  { lvl: 20, name: 'ORCA',           desc: 'Kein Fisch. Interessiert ihn nicht.' }
];

export function fishRank(level) {
  let out = FISH_RANKS[0];
  for (const r of FISH_RANKS) if (level >= r.lvl) out = r;
  return out;
}

export function armyValue(pieces) {
  return pieces.reduce((s, p) => s + (VALUE[p.type] || 0), 0);
}

export function armyCost(pieces) {
  return pieces.reduce((s, p) => s + (COST[p.type] || 0), 0);
}

// --- FEN-Bau -------------------------------------------------------------
// pieces: [{type:'q', color:'w', square:'d1'}, ...]  (Koenige inklusive)
export function buildFen(pieces, turn = 'w') {   // Weiss zieht immer zuerst
  const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const p of pieces) {
    const f = p.square.charCodeAt(0) - 97;
    const r = 8 - parseInt(p.square[1], 10);
    grid[r][f] = p.color === 'w' ? p.type.toUpperCase() : p.type.toLowerCase();
  }
  const rows = grid.map(row => {
    let s = '', empty = 0;
    for (const c of row) {
      if (c) { if (empty) { s += empty; empty = 0; } s += c; }
      else empty++;
    }
    if (empty) s += empty;
    return s;
  });
  // Keine Rochade: Die Startstellungen sind kuenstlich, Rochaderechte waeren Unsinn.
  return `${rows.join('/')} ${turn} - - 0 1`;
}

export const FILES = ['a','b','c','d','e','f','g','h'];
export const sq = (f, r) => FILES[f] + r;

export function squareInfo(s) {
  return { file: s.charCodeAt(0) - 97, rank: parseInt(s[1], 10) };
}

// Du bist SCHWARZ. Weiss (der Gegner) zieht zuerst und kann sich damit gegen
// ein gedrohtes Matt wehren -- sonst waere "Dame hinstellen, Matt in 1" die
// immer gleiche Loesung und das Spiel waere nach zwei Runden durch.
export const PLAYER_COLOR = 'b';
export const ENEMY_COLOR  = 'w';
export const PLAYER_ZONE  = [5, 8];   // deine Haelfte
export const ENEMY_ZONE   = [1, 4];

export function isLegalPlacement(square, type) {
  const { rank } = squareInfo(square);
  if (rank < PLAYER_ZONE[0] || rank > PLAYER_ZONE[1]) return false;
  if (type === 'p' && rank === 8) return false;   // schwarzer Bauer auf Reihe 8 gibt es nicht
  return true;
}

export const PLAYER_KING_SQUARE = 'e8';
