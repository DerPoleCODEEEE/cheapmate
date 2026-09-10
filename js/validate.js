// Pre-fight position check.
// You are Black, WHITE moves first. Therefore:
//  - your (black) king must NOT be in check, because you are not to move
//  - White MAY be in check -- it is to move and has to answer. That is the
//    whole trick: you may threaten mate, White always gets a reply.
//  - White must not already be mated or stalemated, or the fight is over
//    before a single move is played.
import { Chess, validateFen } from '../vendor/chess.js';
import { buildFen, PLAYER_KING_SQUARE } from './rules.js';

export const REASONS = {
  ok:          { ok: true,  msg: 'Ready.' },
  badfen:      { ok: false, msg: 'This position makes no sense.' },
  selfcheck:   { ok: false, msg: 'Your king is in check while White is to move. Illegal.' },
  instantwin:  { ok: false, msg: 'White is already mated. Not that cheap — build it differently.' },
  instantdraw: { ok: false, msg: 'White cannot move at all. That is stalemate, so no win.' }
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

// White moves first. If White can mate immediately the fight is over before
// your fish touches a piece -- and the player cannot see that unaided. We do
// not block it (avoiding it is part of the puzzle) but we warn loudly.
export function whiteHasMateInOne(chess) {
  for (const mv of chess.moves()) {
    chess.move(mv);
    const mate = chess.isCheckmate();
    chess.undo();
    if (mate) return mv;
  }
  return null;
}
