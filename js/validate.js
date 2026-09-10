// Stellungspruefung vor dem Anpfiff.
// Du bist Schwarz, WEISS zieht zuerst. Daraus folgt:
//  - dein (schwarzer) Koenig darf NICHT im Schach stehen (du bist nicht am Zug)
//  - Weiss DARF im Schach stehen -- Weiss ist am Zug und muss reagieren.
//    Genau das ist der Trick: du darfst Matt drohen, Weiss darf sich wehren.
//  - Weiss darf aber nicht schon matt oder patt sein, sonst waere die Runde
//    vorbei, bevor ein Zug faellt.
import { Chess, validateFen } from '../vendor/chess.js';
import { buildFen, PLAYER_KING_SQUARE } from './rules.js';

export const REASONS = {
  ok:         { ok: true,  msg: 'Bereit.' },
  badfen:     { ok: false, msg: 'Diese Stellung ergibt keinen Sinn.' },
  selfcheck:  { ok: false, msg: 'Dein Koenig steht im Schach, obwohl Weiss am Zug ist. Illegal.' },
  instantwin: { ok: false, msg: 'Weiss steht schon matt. So billig gibt es das nicht - stell es anders auf.' },
  instantdraw:{ ok: false, msg: 'Weiss kann sich nicht ruehren. Das waere Patt, also kein Sieg.' }
};

export function validateSetup(enemyPieces, playerPieces) {
  const fen = buildFen([...enemyPieces, ...playerPieces], 'w');

  const v = validateFen(fen);
  if (!v.ok) return { ...REASONS.badfen, fen, detail: v.error };

  const chess = new Chess();
  try { chess.load(fen, { skipValidation: true }); }
  catch (e) { return { ...REASONS.badfen, fen, detail: e.message }; }

  if (chess.isAttacked(PLAYER_KING_SQUARE, 'w')) return { ...REASONS.selfcheck, fen };
  if (chess.moves().length === 0) {
    return chess.isCheck()
      ? { ...REASONS.instantwin, fen }
      : { ...REASONS.instantdraw, fen };
  }
  return {
    ...REASONS.ok, fen, chess,
    givesCheck: chess.isCheck(),
    whiteMateIn1: whiteHasMateInOne(chess)
  };
}

// Weiss zieht zuerst. Wenn Weiss sofort mattsetzen kann, ist die Runde vorbei,
// bevor dein Fisch einen Zug macht -- und der Spieler sieht das nicht von
// allein. Wir sperren es nicht (das Vermeiden ist Teil des Puzzles), aber wir
// warnen deutlich.
export function whiteHasMateInOne(chess) {
  for (const mv of chess.moves()) {
    chess.move(mv);
    const mate = chess.isCheckmate();
    chess.undo();
    if (mate) return mv;
  }
  return null;
}
