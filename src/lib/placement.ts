const GAP = 4;
const MARGIN = 8;

/** Top of a hover card: below the row if it fits, else above, else pinned inside the viewport. */
export function cardTop(
  row: { top: number; bottom: number },
  cardHeight: number,
  viewportHeight: number,
): number {
  const below = row.bottom + GAP;
  if (below + cardHeight <= viewportHeight - MARGIN) return below;
  const above = row.top - GAP - cardHeight;
  if (above >= MARGIN) return above;
  return Math.max(MARGIN, viewportHeight - MARGIN - cardHeight);
}
