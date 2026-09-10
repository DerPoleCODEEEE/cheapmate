// ============================================================================
// All artwork. Black ink on paper, hand-drawn on purpose, googly eyes required.
// Everything is inline SVG: no image files, nothing to 404, scales forever.
// ============================================================================

export const ROUGH_DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="wobble" x="-25%" y="-25%" width="150%" height="150%">
      <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="wobble-hard" x="-25%" y="-25%" width="150%" height="150%">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
</svg>`;

const INK = '#15130f';
const PAPER = '#fdfdfb';

const eyes = (cx, cy, spread, r = 3.4) => `
  <circle cx="${cx - spread}" cy="${cy}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="1.6"/>
  <circle cx="${cx + spread}" cy="${cy}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="1.6"/>
  <circle cx="${cx - spread}" cy="${cy + .8}" r="1.5" fill="${INK}"/>
  <circle cx="${cx + spread}" cy="${cy + .8}" r="1.5" fill="${INK}"/>`;

// ============================================================================
// CHESS PIECES
// ============================================================================
const BODY = {
  p: `<circle cx="50" cy="30" r="13"/>
      <path d="M31 86 C31 64 41 55 50 47 C59 55 69 64 69 86 Z"/>
      <path d="M24 86 L76 86 L78 93 L22 93 Z"/>`,
  r: `<path d="M28 86 L28 42 L27 29 L37 29 L37 37 L45 37 L45 29 L55 29 L55 37 L63 37 L63 29 L73 29 L72 42 L72 86 Z"/>
      <path d="M22 86 L78 86 L80 93 L20 93 Z"/>`,
  n: `<path d="M33 88 L33 63 C33 47 40 35 53 27 L48 17 L61 22 L68 15 L72 30 C78 43 75 58 66 65 L66 88 Z"/>
      <path d="M22 88 L78 88 L80 94 L20 94 Z"/>`,
  b: `<circle cx="50" cy="12" r="4.5"/>
      <path d="M50 19 C61 25 64 37 58 46 L42 46 C36 37 39 25 50 19 Z"/>
      <path d="M33 86 C33 66 43 55 50 47 C57 55 67 66 67 86 Z"/>
      <path d="M23 86 L77 86 L79 93 L21 93 Z"/>`,
  q: `<path d="M30 46 L25 20 L38 33 L50 15 L62 33 L75 20 L70 46 Z"/>
      <path d="M30 46 C30 70 34 78 34 86 L66 86 C66 78 70 70 70 46 Z"/>
      <path d="M22 86 L78 86 L80 93 L20 93 Z"/>`,
  k: `<path d="M50 6 L50 20 M43 12 L57 12"/>
      <path d="M30 48 L30 30 L42 40 L50 24 L58 40 L70 30 L70 48 Z"/>
      <path d="M30 48 C30 70 34 78 34 86 L66 86 C66 78 70 70 70 48 Z"/>
      <path d="M22 86 L78 86 L80 93 L20 93 Z"/>`
};
const EYE_POS = { p: [50, 29, 6], r: [50, 55, 8], n: [58, 34, 6], b: [50, 34, 6], q: [50, 60, 8], k: [50, 62, 8] };

export function pieceSvg(type, color, { size = 100, cls = '' } = {}) {
  const [ex, ey, es] = EYE_POS[type] || [50, 40, 7];
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="piece-svg ${cls}" aria-hidden="true">
    <g filter="url(#wobble)" fill="${color === 'w' ? PAPER : INK}" stroke="${INK}" stroke-width="4.2"
       stroke-linejoin="round" stroke-linecap="round">${BODY[type]}</g>
    ${eyes(ex, ey, es)}
  </svg>`;
}

// ============================================================================
// FISH TIERS - one distinct drawing per rank, so levelling up is *visible*
// ============================================================================
const FISH = {
  // fish stick: a sad breaded rectangle
  stick: { d: `<rect x="18" y="20" width="80" height="30" rx="4"/>
               <path d="M26 20 L26 50 M40 20 L40 50 M54 20 L54 50 M68 20 L68 50 M82 20 L82 50" stroke-width="2"/>`,
           eye: [34, 30, 0], mouth: `<path d="M28 42 q6 3 12 0" fill="none" stroke="${INK}" stroke-width="2"/>` },
  sardine: { d: `<path d="M22 35 C34 20 62 18 80 30 L96 18 L93 35 L96 52 L80 40 C62 52 34 50 22 35 Z"/>`,
             eye: [40, 31, 0] },
  herring: { d: `<path d="M18 36 C32 18 64 16 84 30 L100 16 L96 36 L100 56 L84 42 C64 56 32 54 18 36 Z"/>
                 <path d="M50 20 L58 10 L64 22" fill="none" stroke-width="3.5"/>`,
             eye: [38, 32, 0] },
  mackerel: { d: `<path d="M14 36 C30 16 66 14 88 30 L104 14 L99 36 L104 58 L88 42 C66 58 30 56 14 36 Z"/>
                  <path d="M40 22 L36 50 M52 20 L48 52 M64 22 L60 50" fill="none" stroke-width="3"/>`,
              eye: [32, 32, 0] },
  trout: { d: `<path d="M12 36 C28 14 68 12 90 30 L106 12 L100 36 L106 60 L90 42 C68 60 28 58 12 36 Z"/>
               <circle cx="46" cy="28" r="3.5" fill="${INK}"/><circle cx="60" cy="40" r="3.5" fill="${INK}"/>
               <circle cx="72" cy="26" r="3.5" fill="${INK}"/>`,
           eye: [30, 32, 0] },
  carp: { d: `<path d="M10 36 C26 10 70 8 92 30 L108 10 L101 36 L108 62 L92 42 C70 62 26 60 10 36 Z"/>
              <path d="M22 44 q-10 10 -16 6 M22 48 q-8 12 -16 10" fill="none" stroke-width="3"/>`,
          eye: [30, 30, 0] },
  salmon: { d: `<path d="M8 36 C24 10 70 8 94 28 L112 8 L104 36 L112 64 L94 44 C70 64 24 62 8 36 Z"/>
                <path d="M8 36 q6 -8 14 -4" fill="none" stroke-width="4"/>
                <path d="M56 12 L62 2 L70 16" fill="none" stroke-width="3.5"/>`,
            eye: [28, 31, 0] },
  tuna: { d: `<path d="M6 36 C22 8 72 6 96 28 L118 4 L106 36 L118 68 L96 44 C72 66 22 64 6 36 Z"/>
              <path d="M50 10 L58 -2 L66 14 M52 58 L60 70 L68 54" fill="none" stroke-width="3.5"/>`,
          eye: [26, 31, 0] },
  swordfish: { d: `<path d="M2 34 L34 30 C48 12 78 12 98 28 L116 8 L108 36 L116 64 L98 44 C78 58 48 56 34 40 Z"/>
                   <path d="M2 34 L34 34" stroke-width="6"/>
                   <path d="M58 12 L66 -2 L76 16" fill="none" stroke-width="3.5"/>`,
               eye: [44, 30, 0] },
  barracuda: { d: `<path d="M4 36 C20 22 60 12 94 26 L118 6 L108 36 L118 66 L94 46 C60 60 20 50 4 36 Z"/>
                   <path d="M30 40 L36 48 L42 40 L48 48 L54 40 L60 48 L66 40" fill="none" stroke-width="3"/>`,
               eye: [30, 30, 0] },
  shark: { d: `<path d="M4 44 C22 26 66 18 98 30 L120 12 L110 42 L118 66 L96 50 C64 62 20 58 4 44 Z"/>
               <path d="M52 20 L60 -2 L74 22" fill="none" stroke-width="4"/>
               <path d="M28 48 L34 56 L40 48 L46 56 L52 48" fill="none" stroke-width="3"/>`,
           eye: [30, 36, 0] },
  orca: { d: `<path d="M4 42 C22 20 70 14 102 28 L122 8 L112 42 L120 68 L100 52 C66 66 20 60 4 42 Z"/>
              <path d="M54 16 L62 -6 L78 20" fill="none" stroke-width="4.5"/>
              <ellipse cx="44" cy="34" rx="13" ry="7" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>`,
          eye: [30, 34, 0] }
};

export function fishSvg(art = 'stick', { size = 120, cls = '' } = {}) {
  const f = FISH[art] || FISH.stick;
  const [ex, ey] = f.eye;
  return `<svg viewBox="-4 -8 132 86" width="${size}" class="fish-svg ${cls}" aria-hidden="true">
    <g filter="url(#wobble)" fill="${PAPER}" stroke="${INK}" stroke-width="4"
       stroke-linejoin="round" stroke-linecap="round">${f.d}</g>
    <circle cx="${ex}" cy="${ey}" r="6.5" fill="#fff" stroke="${INK}" stroke-width="2.4"/>
    <circle cx="${ex + 1.5}" cy="${ey + 1}" r="2.8" fill="${INK}" class="fish-pupil"/>
    ${f.mouth || `<path d="M${ex - 10} ${ey + 13} q6 5 13 2" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`}
  </svg>`;
}

// ============================================================================
// PRIME - the villain. A cold rectangular eye, the opposite of a googly one.
// ============================================================================
export const PRIME_SVG = `
<svg viewBox="0 0 200 140" class="prime-svg" aria-hidden="true">
  <g fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round">
    <rect x="14" y="18" width="172" height="104" rx="6" filter="url(#wobble-hard)"/>
    <path d="M14 40 L186 40"/>
  </g>
  <g class="prime-eye">
    <rect x="46" y="62" width="42" height="20" fill="${INK}"/>
    <rect x="112" y="62" width="42" height="20" fill="${INK}"/>
  </g>
  <path d="M70 100 L100 92 L130 100" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <g fill="${INK}" opacity=".5">
    <rect x="24" y="26" width="8" height="8"/><rect x="40" y="26" width="8" height="8"/>
    <rect x="56" y="26" width="8" height="8"/><rect x="152" y="26" width="8" height="8"/>
    <rect x="168" y="26" width="8" height="8"/>
  </g>
</svg>`;

// ============================================================================
// ICONS - coins, hearts, perk symbols
// ============================================================================
export const ICONS = {
  coin: `<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="12.5" stroke-width="2"/>
         <path d="M24 14 L24 34 M28.5 18.5 q-9 -2 -9 3.5 t9 4 t-9 3.5" fill="none" stroke-width="3"/>`,
  heart: `<path d="M24 40 C6 27 8 12 18 11 C22 10.6 24 14 24 16 C24 14 26 10.6 30 11 C40 12 42 27 24 40 Z"/>`,
  tag:   `<path d="M6 22 L22 6 L42 6 L42 26 L26 42 Z"/><circle cx="34" cy="14" r="3.5" fill="${INK}"/>`,
  bolt:  `<path d="M27 4 L11 27 L22 27 L19 44 L37 20 L26 20 Z"/>`,
  clock: `<circle cx="24" cy="24" r="17"/><path d="M24 13 L24 25 L32 30" fill="none" stroke-width="3.4"/>`,
  skull: `<path d="M24 5 C36 5 42 14 42 22 C42 28 38 31 38 35 L38 41 L10 41 L10 35 C10 31 6 28 6 22 C6 14 12 5 24 5 Z"/>
          <circle cx="17" cy="22" r="5" fill="${INK}"/><circle cx="31" cy="22" r="5" fill="${INK}"/>
          <path d="M20 41 L20 34 M28 41 L28 34" stroke-width="3"/>`,
  flag:  `<path d="M11 43 L11 5" stroke-width="4"/><path d="M11 7 L38 13 L11 22 Z"/>`,
  fish:  `<path d="M6 24 C13 14 30 13 40 21 L44 12 L43 24 L44 36 L40 27 C30 35 13 34 6 24 Z"/>
          <circle cx="17" cy="22" r="2.6" fill="${INK}"/>`,
  pawn:   `<circle cx="24" cy="14" r="6.5"/><path d="M14 40 C14 29 19 25 24 21 C29 25 34 29 34 40 Z"/><path d="M11 40 L37 40 L38 44 L10 44 Z"/>`,
  knight: `<path d="M15 43 L15 30 C15 22 19 16 26 12 L23 6 L30 9 L34 5 L36 14 C39 21 38 28 33 31 L33 43 Z"/><path d="M11 43 L37 43 L38 46 L10 46 Z"/>`,
  bishop: `<circle cx="24" cy="7" r="3.4"/><path d="M24 11 C30 15 31 21 28 25 L20 25 C17 21 18 15 24 11 Z"/><path d="M15 43 C15 32 20 26 24 22 C28 26 33 32 33 43 Z"/><path d="M11 43 L37 43 L38 46 L10 46 Z"/>`,
  rook:   `<path d="M13 43 L13 20 L12 13 L18 13 L18 17 L22 17 L22 13 L26 13 L26 17 L30 17 L30 13 L36 13 L35 20 L35 43 Z"/><path d="M10 43 L38 43 L39 46 L9 46 Z"/>`,
  queen:  `<path d="M14 22 L11 9 L18 16 L24 7 L30 16 L37 9 L34 22 Z"/><path d="M14 22 C14 34 16 39 16 43 L32 43 C32 39 34 34 34 22 Z"/><path d="M10 43 L38 43 L39 46 L9 46 Z"/>`,
  wave:   `<path d="M4 30 q8 -10 16 0 t16 0 t8 -2" fill="none" stroke-width="4"/><path d="M4 40 q8 -10 16 0 t16 0 t8 -2" fill="none" stroke-width="4"/>`,
  up:     `<path d="M24 6 L40 26 L31 26 L31 42 L17 42 L17 26 L8 26 Z"/>`,
  crown:  `<path d="M8 34 L5 12 L15 22 L24 8 L33 22 L43 12 L40 34 Z"/><path d="M8 38 L40 38" stroke-width="4"/>`,
  one:    `<circle cx="24" cy="24" r="17"/><path d="M19 17 L25 13 L25 34" fill="none" stroke-width="3.4"/>`
};

export function icon(name, { size = 24, cls = '' } = {}) {
  const d = ICONS[name] || ICONS.coin;
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" class="ic ${cls}" aria-hidden="true">
    <g filter="url(#wobble)" fill="${PAPER}" stroke="${INK}" stroke-width="3.4"
       stroke-linejoin="round" stroke-linecap="round">${d}</g></svg>`;
}

// Solid coin for the money counter, so it reads at small sizes
export const COIN_SOLID = `<svg viewBox="0 0 48 48" class="coin-solid" aria-hidden="true">
  <circle cx="24" cy="24" r="17" fill="${PAPER}" stroke="${INK}" stroke-width="3.6" filter="url(#wobble)"/>
  <circle cx="24" cy="24" r="12" fill="none" stroke="${INK}" stroke-width="1.8"/>
  <path d="M24 14 L24 34 M28.5 18.5 q-9 -2 -9 3.5 t9 4 t-9 3.5" fill="none" stroke="${INK}"
        stroke-width="3" stroke-linecap="round"/></svg>`;

export function heartSvg(filled = true) {
  return `<svg viewBox="0 0 48 48" class="heart-svg${filled ? '' : ' empty'}" aria-hidden="true">
    <path d="M24 40 C6 27 8 12 18 11 C22 10.6 24 14 24 16 C24 14 26 10.6 30 11 C40 12 42 27 24 40 Z"
          fill="${filled ? INK : 'none'}" stroke="${INK}" stroke-width="3.4"
          stroke-linejoin="round" filter="url(#wobble)"/></svg>`;
}
