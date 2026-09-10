// Achievements. Jedes prueft gegen ein Ereignis-Objekt.
// tier: 1 Tinte / 2 Silber / 3 Gold. hidden: Text erst nach Freischaltung sichtbar.

export const ACHIEVEMENTS = [
  // --- Fortschritt --------------------------------------------------------
  { id: 'first_win',  name: 'ERSTER FISCHZUG',  tier: 1, icon: 'fish',
    desc: 'Gewinne deine erste Runde.',
    on: 'roundWon', test: (e, s) => s.roundsWon >= 1 },
  { id: 'round5',     name: 'STAMMKUNDE',       tier: 1, icon: 'flag',
    desc: 'Erreiche Runde 5.',
    on: 'roundStart', test: (e) => e.round >= 5 },
  { id: 'round10',    name: 'TIEFSEE',          tier: 2, icon: 'wave',
    desc: 'Erreiche Runde 10.',
    on: 'roundStart', test: (e) => e.round >= 10 },
  { id: 'round15',    name: 'ABYSSAL',          tier: 3, icon: 'skull',
    desc: 'Erreiche Runde 15.',
    on: 'roundStart', test: (e) => e.round >= 15 },

  // --- Sparsamkeit: die eigentliche Kunst ---------------------------------
  { id: 'cheap12',    name: 'SPARFUCHS',        tier: 1, icon: 'coin',
    desc: 'Gewinne eine Runde fuer weniger als 12$.',
    on: 'roundWon', test: (e) => e.spent < 12 },
  { id: 'cheap_solo', name: 'EINZELKAEMPFER',   tier: 2, icon: 'one',
    desc: 'Gewinne eine Runde mit nur EINER gekauften Figur.',
    on: 'roundWon', test: (e) => e.bought.length === 1 },
  { id: 'rich',       name: 'LIQUIDE',          tier: 2, icon: 'coin',
    desc: 'Habe 150$ gleichzeitig auf dem Konto.',
    on: 'money', test: (e) => e.money >= 150 },
  { id: 'frugal3',    name: 'SCHOTTENROCK',     tier: 3, icon: 'coin',
    desc: 'Gewinne 3 Runden in Folge fuer je unter 20$.',
    on: 'roundWon', test: (e, s) => s.frugalStreak >= 3 },

  // --- Fisch-Level --------------------------------------------------------
  { id: 'stick_win',  name: 'FISCHSTAEBCHEN-SIEG', tier: 2, icon: 'fish',
    desc: 'Gewinne eine Runde mit Fisch-Level 0.',
    on: 'roundWon', test: (e) => e.fishLevel === 0 },
  { id: 'blind_hen',  name: 'BLINDES HUHN',     tier: 3, icon: 'fish',
    desc: 'Gewinne Runde 5 oder spaeter mit Fisch-Level 0.',
    on: 'roundWon', test: (e) => e.fishLevel === 0 && e.round >= 5 },
  { id: 'lvl10',      name: 'DER AUFSTIEG',     tier: 2, icon: 'up',
    desc: 'Bringe deinen Fisch auf Level 10.',
    on: 'upgrade', test: (e) => e.fishLevel >= 10 },
  { id: 'orca',       name: 'ORCA',             tier: 3, icon: 'crown',
    desc: 'Bringe deinen Fisch auf Level 20.',
    on: 'upgrade', test: (e) => e.fishLevel >= 20 },

  // --- Tempo --------------------------------------------------------------
  { id: 'blitz',      name: 'BLITZMATT',        tier: 2, icon: 'bolt',
    desc: 'Setze in unter 12 Halbzuegen matt.',
    on: 'roundWon', test: (e) => e.plies < 12 },
  { id: 'photo',      name: 'ZIELFOTO',         tier: 3, icon: 'clock',
    desc: 'Setze im allerletzten erlaubten Halbzug matt.',
    on: 'roundWon', test: (e) => e.plies >= e.plyLimit - 1 },
  { id: 'slow',       name: 'GEDULDSPROBE',     tier: 1, icon: 'clock',
    desc: 'Setze nach mehr als 45 Halbzuegen matt.',
    on: 'roundWon', test: (e) => e.plies > 45 },

  // --- Stil ---------------------------------------------------------------
  { id: 'pawns_only', name: 'BAUERNAUFSTAND',   tier: 3, icon: 'pawn',
    desc: 'Gewinne eine Runde mit ausschliesslich Bauern.',
    on: 'roundWon', test: (e) => e.bought.length > 0 && e.bought.every(t => t === 'p') },
  { id: 'queen_only', name: 'EINE DAME REICHT', tier: 3, icon: 'queen',
    desc: 'Gewinne eine Runde mit genau einer Dame und sonst nichts.',
    on: 'roundWon', test: (e) => e.bought.length === 1 && e.bought[0] === 'q' },
  { id: 'cavalry',    name: 'REITERSTAFFEL',    tier: 2, icon: 'knight',
    desc: 'Gewinne eine Runde mit vier Springern.',
    on: 'roundWon', test: (e) => e.bought.filter(t => t === 'n').length >= 4 },
  { id: 'towers',     name: 'TURMBAU ZU BABEL', tier: 2, icon: 'rook',
    desc: 'Gewinne eine Runde mit drei oder mehr Tuermen.',
    on: 'roundWon', test: (e) => e.bought.filter(t => t === 'r').length >= 3 },

  // --- Schmerz ------------------------------------------------------------
  { id: 'toofast',    name: 'ZU SCHNELL',       tier: 1, icon: 'skull', hidden: true,
    desc: 'Versuche, Weiss schon vor dem ersten Zug mattzusetzen. Nett gedacht.',
    on: 'illegalSetup', test: (e) => e.reason === 'instantwin' },
  { id: 'stalemate',  name: 'REMIS?! JETZT?!',  tier: 2, icon: 'skull', hidden: true,
    desc: 'Beende eine Runde im Patt.',
    on: 'roundLost', test: (e) => e.reason === 'draw' },
  { id: 'broke',      name: 'INSOLVENT',        tier: 1, icon: 'coin', hidden: true,
    desc: 'Starte eine Runde mit 0$ in der Tasche.',
    on: 'roundStart', test: (e) => e.money === 0 },
  { id: 'intern',     name: 'DER PRAKTIKANT LEBT', tier: 2, icon: 'skull', hidden: true,
    desc: 'Verliere gegen DER PRAKTIKANT. Er wird es allen erzaehlen.',
    on: 'roundLost', test: (e) => e.themeId === 'nackt' },

  // --- Meisterschaft ------------------------------------------------------
  { id: 'flawless',   name: 'MAKELLOS',         tier: 3, icon: 'crown',
    desc: 'Erreiche Runde 10 ohne ein einziges Herz zu verlieren.',
    on: 'roundStart', test: (e, s) => e.round >= 10 && s.heartsLost === 0 }
];

const KEY = 'cheapmate.achievements.v1';

export class AchievementTracker {
  constructor(onUnlock) {
    this.onUnlock = onUnlock;
    this.unlocked = this.load();
    this.stats = { roundsWon: 0, heartsLost: 0, frugalStreak: 0 };
  }

  load() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); }
    catch (e) { return new Set(); }
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify([...this.unlocked])); } catch (e) {}
  }
  reset() { this.unlocked = new Set(); this.save(); }

  // Statistiken, die ueber Runden hinweg zaehlen
  note(event, payload) {
    if (event === 'roundWon') {
      this.stats.roundsWon++;
      this.stats.frugalStreak = payload.spent < 20 ? this.stats.frugalStreak + 1 : 0;
    }
    if (event === 'heartLost') this.stats.heartsLost++;
    if (event === 'runStart') this.stats = { roundsWon: this.stats.roundsWon, heartsLost: 0, frugalStreak: 0 };
  }

  fire(event, payload = {}) {
    this.note(event, payload);
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (a.on !== event) continue;
      if (this.unlocked.has(a.id)) continue;
      let ok = false;
      try { ok = !!a.test(payload, this.stats); } catch (e) { ok = false; }
      if (ok) { this.unlocked.add(a.id); newly.push(a); }
    }
    if (newly.length) { this.save(); newly.forEach(a => this.onUnlock && this.onUnlock(a)); }
    return newly;
  }

  progress() {
    return { done: this.unlocked.size, total: ACHIEVEMENTS.length };
  }
}
