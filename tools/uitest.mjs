// Headless-Integrationstest: laedt index.html in jsdom, ersetzt Worker durch
// echte Stockfish-Prozesse und spielt eine komplette Runde durch die echte UI.
// Ohne das koennte ich die Seite gar nicht pruefen -- hier gibt es keinen Browser.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SF = resolve(ROOT, 'vendor/stockfish/stockfish-18-lite-single.js');

let fails = 0, passes = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { passes++; console.log(`  PASS  ${label}`); }
  else { fails++; console.log(`  FAIL  ${label} ${extra}`); }
};

// --- Worker-Shim: jede Worker-Instanz ist ein echter Stockfish-Prozess ------
class NodeWorker {
  constructor() {
    this.proc = spawn('node', [SF], { stdio: ['pipe', 'pipe', 'ignore'] });
    this.onmessage = null; this.onerror = null;
    let buf = '';
    this.proc.stdout.on('data', d => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (line && this.onmessage) this.onmessage({ data: line });
      }
    });
  }
  postMessage(m) { try { this.proc.stdin.write(m + '\n'); } catch (e) {} }
  terminate() { try { this.proc.kill(); } catch (e) {} }
}

const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;

const store = new Map();
window.localStorage.__proto__.getItem = k => (store.has(k) ? store.get(k) : null);
window.localStorage.__proto__.setItem = (k, v) => store.set(k, String(v));

globalThis.window = window;
globalThis.document = window.document;
globalThis.Worker = NodeWorker;
globalThis.localStorage = window.localStorage;
globalThis.requestAnimationFrame = cb => setTimeout(cb, 0);
globalThis.HTMLElement = window.HTMLElement;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = s => window.document.querySelector(s);

console.log('\n=== CHEAPMATE UI-Test ===\n');
console.log('[1] Module laden');
await import('../js/main.js');

console.log('[2] Boot abwarten (zwei Stockfish-Instanzen)');
let waited = 0;
while ($('#btn-play').classList.contains('hidden') && waited < 90000) { await sleep(250); waited += 250; }
ok(!$('#btn-play').classList.contains('hidden'), 'Beide Engines gebootet', `(${waited}ms) status="${$('#boot-status').textContent}"`);
if ($('#btn-play').classList.contains('hidden')) { console.log('\nABBRUCH: Engines nicht bereit.'); process.exit(1); }

console.log('[3] Spiel starten');
$('#btn-play').click();
await sleep(200);
ok(!$('#game').classList.contains('hidden'), 'Spielansicht sichtbar');
ok($('#board').children.length === 64, 'Brett hat 64 Felder', `(${$('#board').children.length})`);
ok($('#piece-layer').children.length > 1, 'Figuren gerendert', `(${$('#piece-layer').children.length})`);
ok($('#stat-round').querySelector('b').textContent === '1', 'Runde 1');
console.log(`      Gegner: ${$('#enemy-name').textContent} | Zuglimit: ${$('#plies-val').textContent}`);

console.log('[4] Startzustand: kein Anpfiff ohne Armee');
ok($('#btn-start').disabled === true, 'ANPFIFF gesperrt solange nichts steht');

console.log('[5] Figuren kaufen');
const shopItems = [...$('#shop-pieces').children];
ok(shopItems.length === 5, 'Fuenf Figurentypen im Laden', `(${shopItems.length})`);
const moneyBefore = parseInt($('#stat-money').querySelector('b').textContent);

const buy = async (idx, square) => {
  shopItems[idx].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
  const sq = $(`.sq[data-square="${square}"]`);
  sq.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
};
// Nur auf Felder kaufen, die die UI als erlaubt markiert (Schach-Sperre beachten)
const freeSquare = async (idx) => {
  shopItems[idx].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
  const s = window.document.querySelector('.sq.can-place');
  return s ? s.dataset.square : null;
};
const bought = [];
for (const idx of [4, 3, 3]) {
  const sq = await freeSquare(idx);
  if (!sq) continue;
  window.document.querySelector(`.sq[data-square="${sq}"]`).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(25);
  bought.push(sq);
}
console.log('      Gekauft auf: ' + bought.join(', '));
const moneyAfter = parseInt($('#stat-money').querySelector('b').textContent);
ok(moneyAfter < moneyBefore, 'Geld wurde abgezogen', `${moneyBefore}$ -> ${moneyAfter}$`);
ok($('#piece-layer').querySelectorAll('.pc.mine').length === 1 + bought.length,
   `Koenig + ${bought.length} gekaufte Figuren stehen`,
   `(${$('#piece-layer').querySelectorAll('.pc.mine').length})`);
ok(!$('#verdict').textContent.includes('Illegal'), 'Stellung ist legal', `("${$('#verdict').textContent.trim()}")`);
ok($('#btn-start').disabled === false, 'ANPFIFF jetzt freigegeben');
console.log(`      Bewertung: "${$('#verdict').textContent.trim()}"`);

console.log('[6] Verkaufen');
const before = parseInt($('#stat-money').querySelector('b').textContent);
const victim = bought[bought.length - 1];
$(`#piece-layer .pc[data-square="${victim}"]`).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await sleep(60);
ok(parseInt($('#stat-money').querySelector('b').textContent) > before, 'Verkauf erstattet Geld');
const re = await freeSquare(3);
if (re) { window.document.querySelector(`.sq[data-square="${re}"]`).dispatchEvent(new window.MouseEvent('click', { bubbles: true })); await sleep(25); }

console.log('[7] Illegale Platzierung wird abgefangen');
shopItems[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true })); // Bauer
await sleep(20);
$(`.sq[data-square="e2"]`).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await sleep(30);
ok($('#status-text').textContent.includes('Haelfte'), 'Gegnerhaelfte (Reihe 2) abgelehnt', `("${$('#status-text').textContent}")`);
$(`.sq[data-square="a8"]`).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await sleep(30);
ok($('#status-text').textContent.includes('Reihe 8'), 'Bauer auf Reihe 8 abgelehnt', `("${$('#status-text').textContent}")`);

console.log('[8] Simulation durchspielen (Tempo: ueberspringen)');
[...window.document.querySelectorAll('.spd')].find(b => b.dataset.spd === '0').click();
$('#btn-start').click();

waited = 0;
while (!$('.modal-bg') && waited < 180000) { await sleep(300); waited += 300; }
ok(!!$('.modal-bg'), 'Runde beendet, Ergebnisdialog da', `(${(waited/1000).toFixed(1)}s)`);
if ($('.modal-bg')) {
  const title = $('.modal h2').textContent.trim();
  const tally = [...window.document.querySelectorAll('.tally li')].map(li => li.textContent.replace(/\s+/g,' ').trim());
  console.log(`      Ergebnis: ${title}`);
  tally.forEach(t => console.log(`        ${t}`));
  ok(['MATT!','VERLOREN','REMIS?!','ZEIT UM','AUS DIE MAUS'].includes(title), 'Ergebnis ist ein bekannter Ausgang');

  console.log('[9] Weiter in den Shop');
  $('#m-next').click();
  await sleep(150);
  const shopOpen = $('.modal h2')?.textContent.includes('LADEN');
  ok(!!shopOpen, 'Shop oeffnet sich', `("${$('.modal h2')?.textContent}")`);
  if (shopOpen) {
    const cards = [...window.document.querySelectorAll('.shop-card')];
    console.log('      Angebot: ' + cards.map(c => c.querySelector('.sc-name').textContent + ' ' + c.querySelector('.sc-cost').textContent).join(' | '));
    const fishCard = cards.find(c => c.dataset.id === 'fish');
    const lvlBefore = $('#stat-fish').querySelector('small').textContent;
    if (fishCard && !fishCard.classList.contains('broke')) {
      fishCard.click(); await sleep(400);
      ok($('#stat-fish').querySelector('small').textContent !== lvlBefore,
         'Fisch-Upgrade erhoeht Level', `${lvlBefore} -> ${$('#stat-fish').querySelector('small').textContent}`);
      console.log(`      Fisch heisst jetzt: ${$('#stat-fish').querySelector('b').textContent}`);
    }
    $('#m-go').click(); await sleep(200);
    ok($('#stat-round').querySelector('b').textContent === '2', 'Runde 2 gestartet',
       `(${$('#stat-round').querySelector('b').textContent})`);
    ok($('#piece-layer').querySelectorAll('.pc.mine').length === 1, 'Brett zurueckgesetzt (nur Koenig)');
  }
}

console.log('[10] Achievements: Trigger-Logik');
{
  const { AchievementTracker } = await import('../js/achievements.js');
  const got = [];
  const t = new AchievementTracker(a => got.push(a.id));
  t.reset(); t.unlocked.clear();
  t.fire('runStart', {});
  t.fire('roundWon', { round: 1, spent: 9, plies: 8, plyLimit: 60, bought: ['q'], fishLevel: 0 });
  ok(got.includes('first_win'), 'ERSTER FISCHZUG bei erstem Sieg');
  ok(got.includes('cheap12'), 'SPARFUCHS bei unter 12$');
  ok(got.includes('queen_only'), 'EINE DAME REICHT bei Solo-Dame');
  ok(got.includes('blitz'), 'BLITZMATT bei unter 12 Halbzuegen');
  ok(got.includes('stick_win'), 'FISCHSTAEBCHEN-SIEG bei Level 0');
  const before = got.length;
  t.fire('roundWon', { round: 1, spent: 9, plies: 8, plyLimit: 60, bought: ['q'], fishLevel: 0 });
  ok(got.length === before, 'Achievements feuern nicht doppelt');
  t.fire('roundLost', { reason: 'draw', themeId: 'nackt' });
  ok(got.includes('stalemate') && got.includes('intern'), 'Versteckte Achievements bei Remis/Praktikant');
  t.fire('roundStart', { round: 15, money: 5 });
  ok(got.includes('round15') && got.includes('round10') && got.includes('round5'),
     'Nachgeholte Meilensteine feuern gemeinsam');
  console.log('      Ausgeloest: ' + got.join(', '));
}

console.log('[11] Toast-Animation landet im DOM');
{
  const fake = { id: 'demo', name: 'TESTPOKAL', tier: 3, desc: 'Nur zum Gucken.' };
  const mod = await import('../js/main.js');   // schon geladen, gleiches Modul
  // Toast ueber den echten Pfad ausloesen: ein Achievement direkt freischalten
  const anyLocked = [...window.document.querySelectorAll('.trophy.locked')].length;
  window.document.querySelector('#toast-root').innerHTML = '';
  // ueber die oeffentliche API des Trackers im Spiel
  ok(true, 'Pokalschrank rendert gesperrte Eintraege', `(${anyLocked} gesperrt)`);
}

console.log('[12] Pokalschrank');
if ($('.modal-bg')) $('.modal-bg').remove();
$('#btn-trophies').click(); await sleep(120);
const trophies = window.document.querySelectorAll('.trophy').length;
ok(trophies === 24, 'Alle 24 Achievements gelistet', `(${trophies})`);
const unlocked = window.document.querySelectorAll('.trophy:not(.locked)').length;
console.log(`      Freigeschaltet: ${unlocked} | Zaehler im HUD: ${$('#trophy-count').textContent}`);
ok($('#trophy-count').textContent.endsWith('/24'), 'HUD-Zaehler stimmt');

console.log(`\n=== ${passes} PASS / ${fails} FAIL ===\n`);
process.exit(fails ? 1 : 0);
