// Stockfish 18 Lite (single-threaded WASM) as a Web Worker.
// Separate instances on purpose: your fish, the opponent and the referee share
// NO transposition table. Otherwise the weak fish would learn from the strong
// one and the whole upgrade system would be worthless.

const WASM_JS = 'vendor/stockfish/stockfish-18-lite-single.js';
const WASM_BIN = 'vendor/stockfish/stockfish-18-lite-single.wasm';

export class Engine {
  constructor(label) {
    this.label = label;
    this.worker = null;
    this.listeners = new Set();
    this.ready = false;
  }

  async boot(onProgress) {
    // IMPORTANT: inside a Worker, relative URLs resolve against the WORKER
    // script, not the page. A relative path would become
    // /vendor/stockfish/vendor/stockfish/...wasm and 404. So build an absolute
    // URL from the page -- this also works if the game lives in a subfolder.
    const base = (typeof document !== 'undefined' && document.baseURI) || '/';
    const wasmUrl = new URL(WASM_BIN, base).href;
    this.worker = new Worker(`${WASM_JS}#${encodeURIComponent(wasmUrl)}`);
    this.worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : (e.data && e.data.text) || '';
      if (!line) return;
      for (const fn of [...this.listeners]) fn(line);
    };
    this.worker.onerror = (e) => console.error(`[${this.label}] worker error`, e.message || e);

    this.send('uci');
    await this.waitFor(l => l.startsWith('uciok'), 120000);
    this.send('setoption name Hash value 32');
    this.send('setoption name Threads value 1');
    this.send('setoption name Ponder value false');
    this.send('isready');
    await this.waitFor(l => l.startsWith('readyok'), 60000);
    this.ready = true;
    if (onProgress) onProgress(this.label);
  }

  send(cmd) { this.worker.postMessage(cmd); }

  waitFor(test, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.listeners.delete(fn); reject(new Error('engine timeout')); }, timeoutMs);
      const fn = (line) => {
        const r = test(line);
        if (r) { clearTimeout(timer); this.listeners.delete(fn); resolve(r === true ? line : r); }
      };
      this.listeners.add(fn);
    });
  }

  async newGame() {
    this.send('ucinewgame');
    this.send('isready');
    await this.waitFor(l => l.startsWith('readyok'));
  }

  // Returns { move, mate, cp, depth }
  async search(fen, { skill = 20, movetime = 120, depth = null } = {}) {
    this.send(`setoption name Skill Level value ${Math.max(0, Math.min(20, skill))}`);
    this.send(`position fen ${fen}`);
    let info = { mate: null, cp: null, depth: 0 };
    const done = this.waitFor(line => {
      if (line.startsWith('info') && line.includes(' score ')) {
        const d = line.match(/ depth (\d+)/);
        const m = line.match(/score mate (-?\d+)/);
        const c = line.match(/score cp (-?\d+)/);
        if (d) info.depth = +d[1];
        if (m) { info.mate = +m[1]; info.cp = null; }
        else if (c) { info.cp = +c[1]; info.mate = null; }
      }
      if (line.startsWith('bestmove')) {
        const mv = line.split(/\s+/)[1];
        return { move: mv === '(none)' ? null : mv, ...info };
      }
      return null;
    }, 30000);
    this.send(depth ? `go depth ${depth}` : `go movetime ${movetime}`);
    return done;
  }

  destroy() { try { this.send('quit'); this.worker.terminate(); } catch (e) {} }
}
