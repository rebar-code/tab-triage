/**
 * Shift-click: select every id between the anchor and the target in display order.
 * Without a usable anchor, only the target is added.
 */
export function rangeIds(order: number[], anchor: number | null, target: number): number[] {
  const to = order.indexOf(target);
  const from = anchor === null ? -1 : order.indexOf(anchor);
  if (to < 0) return [];
  if (from < 0) return [target];
  const [lo, hi] = from < to ? [from, to] : [to, from];
  return order.slice(lo, hi + 1);
}
