// Kleiner UCI-Client fuer Node (Balancing-Experimente). Browser nutzt js/engine.js.
const { spawn } = require('child_process');

function createUci(binPath) {
  const p = spawn('node', [binPath], { stdio: ['pipe', 'pipe', 'ignore'] });
  const listeners = new Set();
  let buf = '';
  p.stdout.on('data', d => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) for (const fn of [...listeners]) fn(line);
    }
  });
  const send = s => p.stdin.write(s + '\n');
  const waitFor = (test, ms = 120000) => new Promise((res, rej) => {
    const t = setTimeout(() => { listeners.delete(fn); rej(new Error('uci timeout')); }, ms);
    const fn = line => { const r = test(line); if (r) { clearTimeout(t); listeners.delete(fn); res(r); } };
    listeners.add(fn);
  });

  return {
    proc: p, send,
    async init() {
      send('uci'); await waitFor(l => l.startsWith('uciok'));
      send('setoption name Hash value 32');
      send('setoption name Threads value 1');
      send('isready'); await waitFor(l => l.startsWith('readyok'));
    },
    async newGame() { send('ucinewgame'); send('isready'); await waitFor(l => l.startsWith('readyok')); },
    async search(fen, { skill = 20, depth = 10, movetime = null }) {
      send(`setoption name Skill Level value ${skill}`);
      send(`position fen ${fen}`);
      let last = { mate: null, cp: null };
      const done = waitFor(l => {
        if (l.startsWith('info') && l.includes(' score ')) {
          const m = l.match(/score mate (-?\d+)/);
          const c = l.match(/score cp (-?\d+)/);
          if (m) { last = { mate: +m[1], cp: null }; }
          else if (c) { last = { mate: null, cp: +c[1] }; }
        }
        if (l.startsWith('bestmove')) return { move: l.split(/\s+/)[1], ...last };
        return null;
      });
      send(movetime ? `go movetime ${movetime}` : `go depth ${depth}`);
      return done;
    },
    quit() { try { send('quit'); } catch (e) {} setTimeout(() => { try { p.kill(); } catch (e) {} }, 200); }
  };
}
module.exports = { createUci };
