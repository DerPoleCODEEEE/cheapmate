// Core values, prices, fish tiers, FEN building. No DOM, testable in Node.

export const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };

// Shop prices deliberately differ from material value: pawns are relatively
// expensive (a weak engine cannot use them), the queen is relatively cheap
// (she wins games even for an idiot).
export const COST = { p: 2, n: 5, b: 5, r: 8, q: 13 };

export const PIECE_NAME = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };

// You are BLACK. White (the enemy) moves first, so White can always answer a
// threatened mate -- otherwise "drop a queen, mate in one" would be the same
// solution every round.
export const PLAYER_COLOR = 'b';
export const ENEMY_COLOR  = 'w';
export const PLAYER_ZONE  = [5, 8];
export const ENEMY_ZONE   = [1, 4];
export const PLAYER_KING_SQUARE = 'e8';

// --- Fish tiers -------------------------------------------------------------
// `art` picks the drawing; every tier looks visibly different from the last.
export const FISH_TIERS = [
  { lvl: 0,  name: 'FISH STICK',  art: 'stick',     line: 'Not even a whole fish.' },
  { lvl: 2,  name: 'SARDINE',     art: 'sardine',   line: 'Small. Salty. Hangs pieces.' },
  { lvl: 4,  name: 'HERRING',     art: 'herring',   line: 'Spots mate in one. Sometimes.' },
  { lvl: 6,  name: 'MACKEREL',    art: 'mackerel',  line: 'Has heard of development.' },
  { lvl: 8,  name: 'TROUT',       art: 'trout',     line: 'Starting to notice forks.' },
  { lvl: 10, name: 'CARP',        art: 'carp',      line: 'Solid. Dull. Effective.' },
  { lvl: 12, name: 'SALMON',      art: 'salmon',    line: 'Swimming upstream now.' },
  { lvl: 14, name: 'TUNA',        art: 'tuna',      line: 'Calculates deep. Smells worse.' },
  { lvl: 16, name: 'SWORDFISH',   art: 'swordfish', line: 'Pointy. Dangerous. Pricey.' },
  { lvl: 18, name: 'BARRACUDA',   art: 'barracuda', line: 'You would not want to face it.' },
  { lvl: 19, name: 'SHARK',       art: 'shark',     line: 'Smells blood at three pawns.' },
  { lvl: 20, name: 'ORCA',        art: 'orca',      line: 'Not a fish. Does not care.' }
];

export function fishTier(level) {
  let out = FISH_TIERS[0];
  for (const t of FISH_TIERS) if (level >= t.lvl) out = t;
  return out;
}
export function nextFishTier(level) {
  return FISH_TIERS.find(t => t.lvl > level) || null;
}

export function armyValue(pieces) {
  return pieces.reduce((s, p) => s + (VALUE[p.type] || 0), 0);
}

// --- FEN --------------------------------------------------------------------
export function buildFen(pieces, turn = 'w') {   // White always moves first
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
  // No castling: these are artificial positions, castling rights make no sense.
  return `${rows.join('/')} ${turn} - - 0 1`;
}

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const sq = (f, r) => FILES[f] + r;
export function squareInfo(s) { return { file: s.charCodeAt(0) - 97, rank: parseInt(s[1], 10) }; }

// ---------------------------------------------------------------------------
// A chess side can hold at most 16 men. Stockfish REJECTS anything bigger --
// it answers "bestmove (none)" and the fight dies silently, which is exactly
// what happened to the PRIME boss during testing (18 black pieces).
// Verified against the engine: 8 pawns + 4 rooks is fine, 16 non-king is not.
// Impossible-by-promotion armies are deliberately allowed; Stockfish plays
// them happily and "nine queens" is a perfectly good power fantasy.
// ---------------------------------------------------------------------------
export const MAX_NON_KING = 15;

export function countTypes(pieces) {
  const c = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  for (const pc of pieces) if (c[pc.type] != null) c[pc.type]++;
  return c;
}

// Returns null when the army is fine, otherwise a human-readable reason.
export function armyLegalityProblem(counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total > MAX_NON_KING)
    return `Your side is full. A chess army is 16 men including the king — sell something first.`;
  if ((counts.p || 0) > 8) return 'Eight pawns is the hard limit.';
  return null;
}

// maxRank lets the BEACHHEAD perk push the placement zone into enemy territory.
export function isLegalPlacement(square, type, minRank = PLAYER_ZONE[0]) {
  const { rank } = squareInfo(square);
  if (rank < minRank || rank > 8) return false;
  if (type === 'p' && rank === 8) return false;   // black pawns cannot sit on rank 8
  return true;
}
