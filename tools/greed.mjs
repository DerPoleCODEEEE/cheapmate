// Hypothese: Zu viel Material macht das Matt LANGSAMER (Ueberangebot bremst).
// Wenn das stimmt, ist "sparsam kaufen" nicht nur oekonomisch, sondern taktisch noetig.
import { generateEnemy } from '../js/generator.js';
import { referenceBuild } from './autobuild.mjs';
import { playMatch } from './balance.mjs';

const SKILL = +(process.env.SKILL || 12);
const advs = (process.env.ADVS || '3,10,20,35').split(',').map(Number);
const seeds = (process.env.SEEDS || '42,7,1337').split(',').map(Number);

console.log(`Skill ${SKILL} | Zeilen = Gegner (Seed) | Zellen = Ergebnis+Halbzuege`);
console.log('gegner'.padEnd(24) + advs.map(a => ('+' + a).padStart(7)).join(''));
const agg = {};
for (const seed of seeds) {
  const enemy = generateEnemy(5, seed);
  const row = [];
  for (const a of advs) {
    const r = await playMatch(enemy, referenceBuild(enemy.material + a), SKILL, { plyLimit: 90, movetime: 100 });
    row.push(`${r.result[0].toUpperCase()}${r.plies}`.padStart(7));
    (agg[a] = agg[a] || []).push(r.result === 'win' ? r.plies : null);
  }
  console.log(`${enemy.theme.name} (m${enemy.material})`.padEnd(24) + row.join(''));
}
console.log('\nSchnitt Halbzuege bis Matt (nur Siege):');
for (const a of advs) {
  const w = agg[a].filter(x => x !== null);
  console.log(`  +${String(a).padStart(2)}  Siege ${w.length}/${agg[a].length}  ${w.length ? 'oe ' + (w.reduce((s,x)=>s+x,0)/w.length).toFixed(1) + ' Halbzuege' : '-'}`);
}
process.exit(0);
