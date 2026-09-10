// Referenz-Aufstellung: kauft fuer ein Materialbudget eine "vernuenftige" Armee
// und stellt sie auf natuerliche Felder. Wird fuer Balancing UND fuer den
// Solvability-Check des Generators benutzt.
import { VALUE, PLAYER_KING_SQUARE, PLAYER_COLOR } from '../js/rules.js';

const NATURAL = {
  q: ['d8', 'c7', 'd6', 'c5'],
  r: ['a8', 'h8', 'b8', 'g8'],
  b: ['c8', 'g8', 'd6', 'c5'],
  n: ['b8', 'g8', 'c6', 'f6'],
  p: ['a7','b7','c7','g7','h7','a6','b6','c6','d6','e6','f6','g6','h6']
};
// Die Nachbarfelder des Koenigs (e1) kommen ZULETZT dran. Sonst mauert sich
// die Referenz-Aufstellung selbst matt -- ist uns in der Simulation passiert.
const KING_NEIGHBOURS = ['d8', 'f8', 'd7', 'e7', 'f7'];
const FALLBACK = [];
for (const r of [5, 6, 7, 8]) for (const f of 'abcdefgh') {
  const s = f + r;
  if (!KING_NEIGHBOURS.includes(s)) FALLBACK.push(s);
}
// Nie ALLE Fluchtfelder zubauen: zwei bleiben immer frei.
FALLBACK.push('d7', 'f7', 'e7');

export function buyArmy(materialBudget) {
  const out = [];
  let left = materialBudget;
  if (left >= 9) { out.push('q'); left -= 9; }
  while (left >= 5 && out.filter(x => x === 'r').length < 2) { out.push('r'); left -= 5; }
  while (left >= 3 && out.filter(x => x === 'n' || x === 'b').length < 4) {
    out.push(out.filter(x => x === 'n').length <= out.filter(x => x === 'b').length ? 'n' : 'b');
    left -= 3;
  }
  while (left >= 1 && out.filter(x => x === 'p').length < 8) { out.push('p'); left -= 1; }
  while (left >= 5) { out.push('r'); left -= 5; }
  while (left >= 3) { out.push('b'); left -= 3; }
  return out;
}

export function placeArmy(types, occupied = new Set()) {
  const used = new Set([...occupied, PLAYER_KING_SQUARE]);
  let escapesLeft = 3;   // d1/f1/d2/e2/f2: hoechstens 2 davon zubauen
  const pieces = [{ type: 'k', color: PLAYER_COLOR, square: PLAYER_KING_SQUARE }];
  for (const t of types) {
    let sq = (NATURAL[t] || []).find(s => !used.has(s));
    if (sq && KING_NEIGHBOURS.includes(sq)) { if (escapesLeft <= 1) sq = null; }
    if (!sq) sq = FALLBACK.find(s => !used.has(s) && !(t === 'p' && s[1] === '8')
                                     && !(KING_NEIGHBOURS.includes(s) && escapesLeft <= 1));
    if (!sq) continue;
    if (KING_NEIGHBOURS.includes(sq)) escapesLeft--;
    used.add(sq);
    pieces.push({ type: t, color: PLAYER_COLOR, square: sq });
  }
  return pieces;
}

export function referenceBuild(materialBudget) {
  return placeArmy(buyArmy(materialBudget));
}
export const materialOf = ps => ps.reduce((s, p) => s + (VALUE[p.type] || 0), 0);
