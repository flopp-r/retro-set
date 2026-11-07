// ============================================================================
//  RETRO SET — core: the chess rules and the computer player
// ============================================================================
// No DOM here: this file also runs in Node, for the tests and tools. The rules engine (legal moves, check, mate,
// draws) and the computer player will live here once they're agreed with the owner; see AGENTS.md, Architecture.
const CORE = (() => {
'use strict';

// the standard starting position, in FEN (Forsyth–Edwards Notation): the pieces rank by rank from Black's side
// (upper case White, lower case Black, digits for empty squares), then who moves, castling rights, the en passant
// square, the halfmove clock and the move number
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

return { START };
})();
if (typeof module !== 'undefined') module.exports = CORE;
