// Ist die frueh-Kurve mit einem SCHLECHTEN Fisch wirklich schaffbar?
// Simuliert den realistischen Spielverlauf: Runde fuer Runde, Geld wie im Spiel.
import { generateEnemy, enemyMaterialForRound } from '../js/generator.js';
import { CONFIG, plyLimitFor } from '../js/config.js';
import { COST } from '../js/rules.js';
import { buyArmy, placeArmy, materialOf } from './autobuild.mjs';
import { playMatch, makeEngines } from './balance.mjs';

// So wuerde ein durchschnittlicher Spieler upgraden
const FISH_BY_ROUND = [0, 0, 0, 1, 2, 3, 4, 6, 8, 10, 11, 12];

const seeds = (process.env.SEEDS || '11,22,33').split(',').map(Number);
const maxRound = +(process.env.MAXR || 8);

const engines = await makeEngines();
console.log('Runde | Gegner              gMat | Fisch | Geld  mMat | Limit | Ergebnis');
const tally = {};
for (const seed of seeds) {
  for (let round = 1; round <= maxRound; round++) {
    const enemy = generateEnemy(round, seed);
    const fish = FISH_BY_ROUND[Math.min(round, FISH_BY_ROUND.length - 1)];
    // Spieler gibt ungefaehr sein Rundenbudget aus
    const money = round === 1 ? CONFIG.START_MONEY : CONFIG.income(round) + 14;
    // Material das man fuer dieses Geld ungefaehr bekommt (oe ~1.6 $/Materialpunkt)
    const mat = Math.floor(money / 1.6);
    const army = placeArmy(buyArmy(mat));
    const limit = plyLimitFor({ enemyMaterial: enemy.material, fishLevel: fish });
    const r = await playMatch(enemy, army, fish, { plyLimit: limit, movetime: 100, engines });
    tally[r.result] = (tally[r.result] || 0) + 1;
    console.log(
      String(round).padStart(5) + ' | ' +
      enemy.theme.name.padEnd(20) + String(enemy.material).padStart(4) + ' | ' +
      String(fish).padStart(5) + ' | ' + String(money+'$').padStart(5) + String(materialOf(army)).padStart(5) + ' | ' +
      String(limit).padStart(5) + ' | ' + r.result + ' ' + r.plies);
  }
  console.log('');
}
console.log('Gesamt:', JSON.stringify(tally));
process.exit(0);
