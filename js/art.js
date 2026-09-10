// Schwarz-weisser Kritzel-Look. Alle Figuren sind bewusst schief gezeichnet,
// der feTurbulence-Filter wackelt sie zusaetzlich. Kulleraugen sind Pflicht.

export const ROUGH_DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="wobble" x="-25%" y="-25%" width="150%" height="150%">
      <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="wobble-hard" x="-25%" y="-25%" width="150%" height="150%">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3.6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
    </pattern>
  </defs>
</svg>`;

const EYES = (cx = 50, cy = 34, spread = 7, r = 3.4, look = 0) => `
  <circle cx="${cx - spread}" cy="${cy}" r="${r}" fill="#fff" stroke="#111" stroke-width="1.6"/>
  <circle cx="${cx + spread}" cy="${cy}" r="${r}" fill="#fff" stroke="#111" stroke-width="1.6"/>
  <circle cx="${cx - spread + look}" cy="${cy + 0.8}" r="1.5" fill="#111"/>
  <circle cx="${cx + spread + look}" cy="${cy + 0.8}" r="1.5" fill="#111"/>`;

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

export function pieceSvg(type, color, { size = 100, dead = false } = {}) {
  const fill = color === 'w' ? '#fdfdfb' : '#15130f';
  const stroke = '#15130f';
  const [ex, ey, es] = EYE_POS[type] || [50, 40, 7];
  // Gleiche Augen fuer beide Farben: weisse Sklera liest sich auf Tinte wie auf Papier.
  const eyes = EYES(ex, ey, es);
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="piece-svg${dead ? ' dead' : ''}" aria-hidden="true">
    <g filter="url(#wobble)" fill="${fill}" stroke="${stroke}" stroke-width="4.2"
       stroke-linejoin="round" stroke-linecap="round">${BODY[type]}</g>
    ${eyes}
  </svg>`;
}

// Handgezeichnete Brett-Kachel: dunkle Felder werden schraffiert, nicht gefuellt.
export function tileSvg(dark) {
  if (!dark) return '';
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="tile-hatch" aria-hidden="true">
    <rect width="100" height="100" fill="url(#hatch)" color="#15130f" opacity="0.42"/>
  </svg>`;
}

// Kritzel-Rahmen um beliebige Boxen
export function scribbleBox(w = 100, h = 40) {
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="scribble-frame" aria-hidden="true">
    <rect x="2" y="2" width="${w - 4}" height="${h - 4}" fill="none" stroke="#15130f"
          stroke-width="2.4" filter="url(#wobble-hard)" rx="4"/>
  </svg>`;
}

export const FISH_SVG = `
<svg viewBox="0 0 120 70" class="fish-mascot" aria-hidden="true">
  <g filter="url(#wobble)" fill="#fdfdfb" stroke="#15130f" stroke-width="4"
     stroke-linejoin="round" stroke-linecap="round">
    <path d="M12 36 C24 14 60 10 84 26 L104 12 L100 36 L104 60 L84 46 C60 62 24 58 12 36 Z"/>
  </g>
  <circle cx="34" cy="31" r="6.5" fill="#fff" stroke="#15130f" stroke-width="2.4"/>
  <circle cx="35.5" cy="32" r="2.8" fill="#15130f" class="fish-pupil"/>
  <path d="M22 44 q6 5 13 2" fill="none" stroke="#15130f" stroke-width="2.6" stroke-linecap="round"/>
</svg>`;
