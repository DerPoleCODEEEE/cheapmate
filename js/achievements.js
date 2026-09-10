// Achievements. Each one tests against an event payload.
// tier: 1 ink / 2 silver / 3 gold. hidden: text stays secret until unlocked.

export const ACHIEVEMENTS = [
  // --- progress -----------------------------------------------------------
  { id: 'first_win', name: 'FIRST CATCH', tier: 1, on: 'roundWon',
    desc: 'Win your first fight.', test: (e, s) => s.roundsWon >= 1 },
  { id: 'wave2', name: 'STILL FLOATING', tier: 1, on: 'roundStart',
    desc: 'Reach wave 2.', test: e => e.wave >= 2 },
  { id: 'wave4', name: 'DEEP WATER', tier: 2, on: 'roundStart',
    desc: 'Reach wave 4.', test: e => e.wave >= 4 },
  { id: 'wave6', name: 'THE ABYSS', tier: 3, on: 'roundStart',
    desc: 'Reach wave 6 and look PRIME in the eye.', test: e => e.wave >= 6 },

  // --- bosses -------------------------------------------------------------
  { id: 'boss_gatekeeper', name: 'THROUGH THE GATE', tier: 2, on: 'roundWon',
    desc: 'Beat THE GATEKEEPER.', test: e => e.bossName === 'THE GATEKEEPER' },
  { id: 'boss_twins', name: 'BROKEN PAIR', tier: 2, on: 'roundWon',
    desc: 'Beat THE TWINS.', test: e => e.bossName === 'THE TWINS' },
  { id: 'boss_collector', name: 'REPOSSESSED', tier: 2, on: 'roundWon',
    desc: 'Beat THE COLLECTOR.', test: e => e.bossName === 'THE COLLECTOR' },
  { id: 'boss_zugzwang', name: 'OUT OF MOVES', tier: 3, on: 'roundWon',
    desc: 'Beat ZUGZWANG.', test: e => e.bossName === 'ZUGZWANG' },
  { id: 'boss_mirror', name: 'NOTHING LEFT TO COPY', tier: 3, on: 'roundWon',
    desc: 'Beat THE MIRROR.', test: e => e.bossName === 'THE MIRROR' },
  { id: 'boss_prime', name: 'CHEAPMATE', tier: 3, on: 'roundWon',
    desc: 'Beat PRIME. Finish the run.', test: e => e.bossName === 'PRIME' },

  // --- thrift: the actual skill of this game ------------------------------
  { id: 'cheap12', name: 'PENNY PINCHER', tier: 1, on: 'roundWon',
    desc: 'Win a fight for under $12.', test: e => e.spent < 12 },
  { id: 'cheap_solo', name: 'LONE OPERATIVE', tier: 2, on: 'roundWon',
    desc: 'Win with exactly one bought piece.', test: e => e.bought.length === 1 },
  { id: 'freebie', name: 'PAID NOTHING', tier: 3, on: 'roundWon', hidden: true,
    desc: 'Win a fight without spending a single dollar.', test: e => e.spent <= 0 },
  { id: 'rich', name: 'LIQUID', tier: 2, on: 'money',
    desc: 'Hold $300 at once.', test: e => e.money >= 300 },
  { id: 'impossible', name: 'IMPOSSIBLE', tier: 3, on: 'roundWon',
    desc: 'Win a fight with LESS material than White. The top THRIFT tier.',
    test: e => e.thriftName === 'IMPOSSIBLE' },
  { id: 'shoestring', name: 'SHOESTRING', tier: 2, on: 'roundWon',
    desc: 'Win at THRIFT tier SHOESTRING or better.',
    test: e => ['IMPOSSIBLE', 'SHOESTRING'].includes(e.thriftName) },
  { id: 'surgical', name: 'SURGICAL', tier: 2, on: 'roundWon',
    desc: 'Mate inside the first third of the clock.',
    test: e => (e.speedMult || 0) >= 1.5 },
  { id: 'perfectbet', name: 'PERFECT BET', tier: 3, on: 'roundWon', hidden: true,
    desc: 'Land the top THRIFT and top SPEED multiplier in the same fight.',
    test: e => (e.thriftMult || 0) >= 3 && (e.speedMult || 0) >= 1.5 },
  { id: 'bigpay', name: 'PAYDAY', tier: 2, on: 'roundWon',
    desc: 'Earn $200 or more from a single fight.', test: e => (e.total || 0) >= 200 },
  { id: 'frugal3', name: 'TIGHT FISTED', tier: 3, on: 'roundWon',
    desc: 'Win three fights in a row for under $20 each.', test: (e, s) => s.frugalStreak >= 3 },

  // --- your fish ----------------------------------------------------------
  { id: 'stick_win', name: 'FISH STICK VICTORY', tier: 2, on: 'roundWon',
    desc: 'Win a fight at skill 0.', test: e => e.fishLevel === 0 },
  { id: 'blind_hen', name: 'BLIND LUCK', tier: 3, on: 'roundWon',
    desc: 'Win in wave 2 or later at skill 0.', test: e => e.fishLevel === 0 && e.wave >= 2 },
  { id: 'underdog', name: 'UNDERDOG', tier: 3, on: 'roundWon', hidden: true,
    desc: 'Beat a boss with a fish below skill 6.', test: e => e.isBoss && e.fishLevel < 6 },
  { id: 'lvl10', name: 'THE ASCENT', tier: 2, on: 'upgrade',
    desc: 'Get your fish to skill 10.', test: e => e.fishLevel >= 10 },
  { id: 'orca', name: 'ORCA', tier: 3, on: 'upgrade',
    desc: 'Get your fish to skill 20.', test: e => e.fishLevel >= 20 },

  // --- perks --------------------------------------------------------------
  { id: 'perk1', name: 'REGULAR CUSTOMER', tier: 1, on: 'perk',
    desc: 'Buy your first perk.', test: (e, s) => s.perkCount >= 1 },
  { id: 'perk6', name: 'STACKED', tier: 2, on: 'perk',
    desc: 'Own six perks at once.', test: (e, s) => s.perkCount >= 6 },
  { id: 'perk12', name: 'UNFAIR', tier: 3, on: 'perk',
    desc: 'Own twelve perks. The fish is now a problem.', test: (e, s) => s.perkCount >= 12 },
  { id: 'bloodbath', name: 'BLOODBATH', tier: 2, on: 'roundWon', hidden: true,
    desc: 'Take 20 or more points of material in a single fight.',
    test: e => (e.pay && e.pay.capturedValue || 0) >= 20 },
  { id: 'untouched', name: 'NOT A SCRATCH', tier: 3, on: 'roundWon', hidden: true,
    desc: 'Win without losing a single piece.',
    test: e => e.pay && e.pay.survivingValue >= (e.startEdge + 0) && e.bought.length > 0 &&
              e.pay.survivingValue === e.bought.reduce((s, t) => s + ({p:1,n:3,b:3,r:5,q:9}[t] || 0), 0) },

  // --- tempo --------------------------------------------------------------
  { id: 'blitz', name: 'SNAP MATE', tier: 2, on: 'roundWon',
    desc: 'Mate in under 12 half-moves.', test: e => e.plies < 12 },
  { id: 'photo', name: 'PHOTO FINISH', tier: 3, on: 'roundWon',
    desc: 'Mate on the very last legal half-move.', test: e => e.plies >= e.plyLimit - 1 },
  { id: 'overtime', name: 'ON APPEAL', tier: 2, on: 'roundWon', hidden: true,
    desc: 'Win a fight through OVERTIME.', test: e => e.overtimeUsed },

  // --- style --------------------------------------------------------------
  { id: 'pawns_only', name: 'PEASANT REVOLT', tier: 3, on: 'roundWon',
    desc: 'Win using nothing but pawns.', test: e => e.bought.length > 0 && e.bought.every(t => t === 'p') },
  { id: 'queen_only', name: 'ONE QUEEN IS PLENTY', tier: 3, on: 'roundWon',
    desc: 'Win with a single queen and nothing else.', test: e => e.bought.length === 1 && e.bought[0] === 'q' },
  { id: 'cavalry', name: 'FOUR HORSEMEN', tier: 2, on: 'roundWon',
    desc: 'Win a fight with four knights.', test: e => e.bought.filter(t => t === 'n').length >= 4 },

  // --- pain ---------------------------------------------------------------
  { id: 'toofast', name: 'TOO EAGER', tier: 1, on: 'illegalSetup', hidden: true,
    desc: 'Try to mate White before it has moved once. Nice try.',
    test: e => e.reason === 'instantwin' },
  { id: 'stalemate', name: 'A DRAW? NOW?', tier: 2, on: 'roundLost', hidden: true,
    desc: 'End a fight in stalemate.', test: e => e.reason === 'draw' },
  { id: 'intern', name: 'THE INTERN LIVES', tier: 2, on: 'roundLost', hidden: true,
    desc: 'Lose to THE INTERN. It will tell everyone.', test: e => e.themeId === 'intern' },

  // --- mastery ------------------------------------------------------------
  { id: 'streak8', name: 'UNBEATEN', tier: 3, on: 'roundWon',
    desc: 'Win eight fights in one run. There are no second chances.',
    test: (e, s) => s.roundsWon >= 8 }
];

const KEY = 'cheapmate.achievements.v2';

export class AchievementTracker {
  constructor(onUnlock) {
    this.onUnlock = onUnlock;
    this.unlocked = this.load();
    this.stats = { roundsWon: 0, frugalStreak: 0, perkCount: 0 };
  }

  load() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); }
    catch (e) { return new Set(); }
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify([...this.unlocked])); } catch (e) {} }
  reset() { this.unlocked = new Set(); this.save(); }

  note(event, p) {
    if (event === 'roundWon') {
      this.stats.roundsWon++;
      this.stats.frugalStreak = p.spent < 20 ? this.stats.frugalStreak + 1 : 0;
    }
    if (event === 'perk') this.stats.perkCount = p.perkCount || 0;
    if (event === 'runStart') {
      this.stats.roundsWon = 0; this.stats.frugalStreak = 0; this.stats.perkCount = 0;
    }
  }

  fire(event, payload = {}) {
    this.note(event, payload);
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (a.on !== event || this.unlocked.has(a.id)) continue;
      let ok = false;
      try { ok = !!a.test(payload, this.stats); } catch (e) { ok = false; }
      if (ok) { this.unlocked.add(a.id); newly.push(a); }
    }
    if (newly.length) { this.save(); newly.forEach(a => this.onUnlock && this.onUnlock(a)); }
    return newly;
  }

  progress() { return { done: this.unlocked.size, total: ACHIEVEMENTS.length }; }
}
