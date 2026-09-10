// ============================================================================
// Opening cutscene. Deliberately inverted: white ink on black, letterboxed,
// so the bright paper world lands as a relief afterwards.
//
// The player advances every screen by clicking. Nothing disappears on a timer:
// a first click finishes the typing instantly, the next one moves on.
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
  // A proper fish, not a fish stick -- the joke lands better once you can see
  // what you are supposed to become.
  if (fx === 'fish')  return `<div class="cine-art cine-fish">${fishSvg('trout', { size: 300 })}</div>`;
  if (fx === 'coins') return `<div class="cine-art cine-coins">${
      Array.from({ length: 12 }, (_, i) =>
        `<span style="left:${4 + i * 8}%;animation-delay:${(i % 5) * 170}ms">${COIN_SOLID}</span>`).join('')
    }</div>`;
  if (fx === 'title') return `<div class="cine-art cine-title"><h1>CHEAP<span>MATE</span></h1></div>`;
  return '';
}

export function playIntro({ force = false } = {}) {
  return new Promise(async (resolve) => {
    if (introSeen() && !force) return resolve('skipped');

    let finished = false;
    let advance = null;        // resolves the current "wait for click"
    let hurry = false;         // set by a click while text is still typing

    const root = document.createElement('div');
    root.className = 'cinema';
    root.innerHTML = `
      <div class="cine-bar top"></div>
      <div class="cine-stage" id="cine-stage"></div>
      <div class="cine-text" id="cine-text"></div>
      <div class="cine-next" id="cine-next" hidden>click to continue</div>
      <div class="cine-bar bottom"></div>
      <button class="cine-skip" id="cine-skip">SKIP INTRO &raquo;</button>`;
    document.body.appendChild(root);

    const finish = (why) => {
      if (finished) return;
      finished = true;
      cleanup();
      markSeen();
      root.classList.add('cine-out');
      setTimeout(() => { root.remove(); resolve(why); }, 700);
    };

    const onClick = (e) => {
      if (e.target && e.target.id === 'cine-skip') return;   // skip has its own handler
      if (hurry === false && advance === null) return;
      if (advance) { const go = advance; advance = null; go(); }
      else hurry = true;
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { finish('skipped'); return; }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onClick({}); }
    };
    const cleanup = () => {
      root.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
    };
    root.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    root.querySelector('#cine-skip').onclick = (e) => { e.stopPropagation(); finish('skipped'); };

    const stage = root.querySelector('#cine-stage');
    const textBox = root.querySelector('#cine-text');
    const nextHint = root.querySelector('#cine-next');
    let lastFx = null;

    // Types a line out; a click mid-typing fills it in at once.
    const typeLine = async (node, text, speed) => {
      for (let i = 0; i < text.length; i++) {
        if (hurry || finished) { node.textContent = text; return; }
        node.textContent = text.slice(0, i + 1);
        if (text[i] !== ' ' && i % 2 === 0) sfx.play('typewriter');
        await sleep(speed);
      }
    };

    const waitForClick = () => new Promise(res => { advance = res; });

    for (const shot of INTRO) {
      if (finished) break;
      hurry = false;
      nextHint.hidden = true;

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
        await typeLine(nodes[i], shot.lines[i], shot.fx === 'title' ? 52 : 22);
        if (!hurry && !finished) await sleep(120);
      }
      if (finished) break;

      nextHint.textContent = shot.fx === 'title' ? 'click to begin' : 'click to continue';
      nextHint.hidden = false;
      await waitForClick();

      if (shot.fx !== 'title') {
        textBox.classList.add('fade');
        await sleep(240);
        textBox.classList.remove('fade');
      }
    }

    finish('played');
  });
}
