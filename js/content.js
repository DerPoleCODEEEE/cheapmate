// ============================================================================
// STORY, WAVES, BOSSES.  All player-facing English text lives here.
// ============================================================================

export const STORY = {
  villain: 'PRIME',
  logline: 'You cannot outthink it. So outspend it.'
};

// --- Intro cutscene ---------------------------------------------------------
// Each shot: text, how long it holds (ms), and a visual cue for the renderer.
export const INTRO = [
  { fx: 'void',    ms: 900, lines: ['In 1997, a machine beat a man.'] },
  { fx: 'void',    ms: 900, lines: ['In 2017, a machine beat every other machine.'] },
  { fx: 'void',    ms: 1100, lines: ['Nothing has beaten one since.'] },
  { fx: 'prime',   ms: 1700, lines: ['They called it', 'PRIME'] },
  { fx: 'prime',   ms: 1500, lines: ['It does not blunder.', 'It does not tire.', 'It does not lose.'] },
  { fx: 'fish',    ms: 1500, lines: ['You are not PRIME.', 'You are four hundred lines of an evaluation',
                                     'function someone deleted in 2011.'] },
  { fx: 'fish',    ms: 1300, lines: ['You are, technically, a fish.'] },
  { fx: 'coins',   ms: 1500, lines: ['You will never out-calculate it.', 'But PRIME has no wallet.'] },
  { fx: 'title',   ms: 2400, lines: ['CHEAPMATE'] }
];

// --- Wave structure ---------------------------------------------------------
export const SKIRMISHES_PER_WAVE = 3;      // 3 normal fights, then a warden
export const WAVES_TO_PRIME = 5;           // wave 6 is PRIME itself

export function scheduleFor(roundIndex) {
  // roundIndex is 1-based and counts every fight, bosses included.
  const perWave = SKIRMISHES_PER_WAVE + 1;
  const wave = Math.floor((roundIndex - 1) / perWave) + 1;
  const slot = ((roundIndex - 1) % perWave) + 1;     // 1..4, 4 = boss
  return { wave, slot, isBoss: slot === perWave, skirmish: Math.min(slot, SKIRMISHES_PER_WAVE) };
}

// --- Bosses -----------------------------------------------------------------
// Handcrafted White armies. Every one is checked by tools/bosscheck.mjs for
// legality (Black king on e8 not attacked, White has legal moves) and for
// being winnable at the fish level a player realistically arrives with.
//
// mods:
//   budget      extra dollars for this fight only
//   ply         change to the half-move limit
//   fish        change to your engine's skill level for this fight only
//   mirror      White also gets a copy of your most expensive purchase
export const BOSSES = [
  {
    id: 'gatekeeper', wave: 1,
    name: 'THE GATEKEEPER',
    title: 'Warden of the First Rank',
    taunt: 'Nothing gets through. Nothing ever has.',
    defeat: 'The wall comes down. PRIME notices you.',
    mods: { budget: 18 },
    modText: '+$18 for this fight. You will need every cent.',
    pieces: [
      { type: 'k', square: 'c1' }, { type: 'r', square: 'a1' }, { type: 'r', square: 'h1' },
      { type: 'p', square: 'a2' }, { type: 'p', square: 'b2' }, { type: 'p', square: 'c2' },
      { type: 'p', square: 'd2' }, { type: 'p', square: 'e2' }, { type: 'p', square: 'f2' },
      { type: 'p', square: 'g2' }, { type: 'p', square: 'h2' }, { type: 'b', square: 'd1' }
    ]
  },
  {
    id: 'twins', wave: 2,
    name: 'THE TWINS',
    title: 'They Move Together',
    taunt: 'We do not wait. Neither should you.',
    defeat: 'One falls. The other stops moving entirely.',
    // -16 Halbzuege waren im Test unzuverlaessig (mal Sieg, mal Timeout).
    // -12 mit mehr Budget ist immer noch hektisch, aber fair.
    // Gemessen: unter ~36 Material bekommt ein Fisch auf Skill 6 die beiden
    // hier nie rechtzeitig matt. Deshalb viel Budget statt weniger Zuege.
    mods: { ply: -12, budget: 26 },
    modText: '12 fewer half-moves, +$26. Buy big — this one has to die fast.',
    pieces: [
      // Tuerme verbunden auf c2/d2. NICHT auf e2 -- das gaebe ueber die
      // offene e-Linie sofort Schach gegen den Spielerkoenig auf e8.
      { type: 'k', square: 'g1' }, { type: 'r', square: 'c2' }, { type: 'r', square: 'd2' },
      { type: 'n', square: 'c3' }, { type: 'n', square: 'f3' },
      { type: 'p', square: 'f2' }, { type: 'p', square: 'g2' }, { type: 'p', square: 'h2' },
      { type: 'p', square: 'a3' }, { type: 'p', square: 'b2' }
    ]
  },
  {
    id: 'collector', wave: 3,
    name: 'THE COLLECTOR',
    title: 'She Keeps What She Takes',
    taunt: 'Your pieces will look lovely on my side of the board.',
    defeat: 'The collection is broken up and sold for parts.',
    mods: { budget: 34 },
    modText: 'Two queens. +$34, because otherwise this would be rude.',
    pieces: [
      // Laeufer auf d3, NICHT c4: von c4 deckt er f7 und zusammen mit der Dame
      // auf f3 steht Dxf7# schon vor deinem ersten Zug auf dem Brett. Ein Boss
      // darf hart sein, aber nicht vor dem Anpfiff gewinnen.
      { type: 'k', square: 'b1' }, { type: 'q', square: 'd1' }, { type: 'q', square: 'f3' },
      { type: 'b', square: 'd3' },
      { type: 'p', square: 'a2' }, { type: 'p', square: 'b2' }, { type: 'p', square: 'c2' },
      { type: 'p', square: 'g2' }, { type: 'p', square: 'h2' }
    ]
  },
  {
    id: 'zugzwang', wave: 4,
    name: 'ZUGZWANG',
    title: 'Every Move Makes It Worse',
    taunt: 'I have very little. You have very little time.',
    defeat: 'It runs out of moves. Finally, something does.',
    // Gemessen: -26 Halbzuege waren nicht zu schaffen, selbst mit gutem Fisch
    // und dickem Material. -16 ist knapp, aber machbar.
    mods: { ply: -16, budget: 28 },
    modText: 'A thin army, but 16 fewer half-moves. Speed is the whole puzzle.',
    pieces: [
      { type: 'k', square: 'h1' }, { type: 'r', square: 'a1' }, { type: 'b', square: 'c1' },
      { type: 'p', square: 'g2' }, { type: 'p', square: 'h2' }, { type: 'p', square: 'f2' }
    ]
  },
  {
    id: 'mirror', wave: 5,
    name: 'THE MIRROR',
    title: 'It Has Been Watching You Shop',
    taunt: 'Whatever you buy, I already own.',
    defeat: 'It runs out of things to copy.',
    mods: { budget: 40, mirror: true },
    modText: 'It copies your most expensive piece. +$40 to make that a real choice.',
    pieces: [
      { type: 'k', square: 'e1' }, { type: 'r', square: 'a1' }, { type: 'r', square: 'h1' },
      { type: 'b', square: 'c1' }, { type: 'n', square: 'b1' },
      { type: 'p', square: 'a2' }, { type: 'p', square: 'b2' }, { type: 'p', square: 'e2' },
      { type: 'p', square: 'g2' }, { type: 'p', square: 'h2' }
    ]
  },
  {
    id: 'prime', wave: 6,
    name: 'PRIME',
    title: 'The One That Solved It',
    taunt: 'I have already seen this game. You lose on move forty-one.',
    defeat: 'PRIME halts. For the first time, it has nothing to calculate.',
    mods: { budget: 70, fish: -3 },
    modText: 'PRIME jams your engine: -3 skill for this fight. +$70. Spend it all.',
    pieces: [
      { type: 'k', square: 'g1' }, { type: 'q', square: 'd1' },
      { type: 'r', square: 'a1' }, { type: 'r', square: 'f1' },
      { type: 'b', square: 'c1' }, { type: 'b', square: 'e3' },
      { type: 'n', square: 'b1' }, { type: 'n', square: 'f3' },
      { type: 'p', square: 'a2' }, { type: 'p', square: 'b2' }, { type: 'p', square: 'c2' },
      { type: 'p', square: 'f2' }, { type: 'p', square: 'g2' }, { type: 'p', square: 'h2' }
    ]
  }
];

export function bossForWave(wave) {
  return BOSSES.find(b => b.wave === wave) || BOSSES[BOSSES.length - 1];
}

// --- Enemy flavour for normal fights ---------------------------------------
export const RANK_TAUNTS = [
  'It has read about openings.',
  'It is doing its best.',
  'It has been told you are cheap.',
  'It wants a promotion.',
  'It does not know it is a tutorial.',
  'PRIME sent this one to waste your money.'
];
