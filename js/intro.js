// ============================================================================
// Opening cutscene. Deliberately inverted: white ink on black, letterboxed,
// so the paper-bright game world lands as a relief afterwards.
// Skippable at any time, and skipped automatically on repeat visits unless
// the player asks to see it again.
// ============================================================================
import { INTRO } from './content.js';
import { PRIME_SVG, fishSvg, COIN_SOLID } from './art.js';
import { sfx } from './sfx.js';

const SEEN_KEY = 'cheapmate.introSeen.v1';
export const introSeen = () => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; } };
const markSeen = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {} };

const sleep = ms => new Promise(r => setTimeout(r, ms));

function stageFor(fx) {
  if (fx === 'prime') return `<div class="cine-art cine-prime">${PRIME_SVG}</div>`;
  if (fx === 'fish')  return `<div class="cine-art cine-fish">${fishSvg('stick', { size: 260 })}</div>`;
  if (fx === 'coins') return `<div class="cine-art cine-coins">${
      Array.from({ length: 12 }, (_, i) =>
        `<span style="left:${4 + i * 8}%;animation-delay:${(i % 5) * 170}ms">${COIN_SOLID}</span>`).join('')
    }</div>`;
  if (fx === 'title') return `<div class="cine-art cine-title"><h1>CHEAP<span>MATE</span></h1></div>`;
  return '';
}

// Types a line out character by character with a soft key click.
async function typeLine(node, text, speed, aborted) {
  for (let i = 0; i < text.length; i++) {
    if (aborted()) { node.textContent = text; return; }
    node.textContent = text.slice(0, i + 1);
    if (text[i] !== ' ' && i % 2 === 0) sfx.play('typewriter');
    await sleep(speed);
  }
}

export function playIntro({ force = false } = {}) {
  return new Promise(async (resolve) => {
    if (introSeen() && !force) return resolve('skipped');

    let done = false, skip = false;
    const aborted = () => skip || done;

    const root = document.createElement('div');
    root.className = 'cinema';
    root.innerHTML = `
      <div class="cine-bar top"></div>
      <div class="cine-stage" id="cine-stage"></div>
      <div class="cine-text" id="cine-text"></div>
      <div class="cine-bar bottom"></div>
      <button class="cine-skip" id="cine-skip">SKIP &raquo;</button>`;
    document.body.appendChild(root);

    const finish = (why) => {
      if (done) return;
      done = true;
      markSeen();
      root.classList.add('cine-out');
      setTimeout(() => { root.remove(); resolve(why); }, 700);
    };
    root.querySelector('#cine-skip').onclick = () => { skip = true; finish('skipped'); };
    const onKey = e => { if (e.key === 'Escape' || e.key === ' ') { skip = true; finish('skipped'); } };
    window.addEventListener('keydown', onKey);

    const stage = root.querySelector('#cine-stage');
    const textBox = root.querySelector('#cine-text');
    let lastFx = null;

    for (const shot of INTRO) {
      if (aborted()) break;

      if (shot.fx !== lastFx) {
        stage.innerHTML = stageFor(shot.fx);
        stage.className = 'cine-stage fx-' + shot.fx;
        lastFx = shot.fx;
        if (shot.fx === 'prime') sfx.play('primeHum');
        if (shot.fx === 'title') sfx.play('mate');
        if (shot.fx === 'coins') sfx.play('coin');
        if (shot.fx === 'fish')  sfx.play('whoosh');
      }

      textBox.innerHTML = '';
      const nodes = shot.lines.map(() => {
        const p = document.createElement('p');
        p.className = 'cine-line';
        textBox.appendChild(p);
        return p;
      });
      for (let i = 0; i < shot.lines.length; i++) {
        if (aborted()) { nodes[i].textContent = shot.lines[i]; continue; }
        await typeLine(nodes[i], shot.lines[i], shot.fx === 'title' ? 52 : 22, aborted);
        await sleep(140);
      }
      if (aborted()) break;
      await sleep(shot.ms);
      if (shot.fx !== 'title') {
        textBox.classList.add('fade');
        await sleep(280);
        textBox.classList.remove('fade');
      }
    }

    window.removeEventListener('keydown', onKey);
    finish('played');
  });
}
