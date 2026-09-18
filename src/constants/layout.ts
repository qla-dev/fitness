/**
 * Screen layout spacing, in one place so cards line up across screens.
 *
 * These were drifting: the Activities screen put 16 down each side and 12
 * between its cards, while the Tracker used 16 down the side, 8 between the
 * meal rows, 8 between the measurement rows and whatever `justify-between` left
 * over between the two tile columns — about 15. Four gaps that were meant to
 * read as one, none of them equal.
 */

/** Space down each side of a screen's scrolling content. */
export const SCREEN_GUTTER = 16;

/**
 * The gap between any two cards, in either direction. One value for both axes
 * deliberately: a grid whose columns sit closer together than its rows reads as
 * a mistake, and the tile grid, the photo strip and the meal list are all the
 * same kind of card stacked in the same column.
 */
export const CARD_GAP = 12;
