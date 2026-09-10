// Stockfish 18 Lite (single-thread WASM) als Web Worker.
// Zwei getrennte Instanzen: dein Fisch und der Gegner teilen sich KEINE
// Transpositionstabelle. Sonst wuerde der schwache Fisch vom starken
// mitlernen und das ganze Upgrade-System waere kaputt.

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
    // WICHTIG: Im Worker loesen sich relative URLs gegen das WORKER-Skript auf,
    // nicht gegen die Seite. Ein relativer Pfad wuerde hier zu
    // /vendor/stockfish/vendor/stockfish/...wasm und damit auf 404 laufen.
    // Darum die absolute URL aus der Seite bauen -- funktioniert auch, wenn
    // das Spiel in einem Unterordner liegt.
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

  // Liefert {move, mate, cp, depth}
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

  // Reine Stellungsbewertung aus Sicht der Seite am Zug.
  async evaluate(fen, depth = 12) {
    const r = await this.search(fen, { skill: 20, depth });
    return r;
  }

  destroy() { try { this.send('quit'); this.worker.terminate(); } catch (e) {} }
}
