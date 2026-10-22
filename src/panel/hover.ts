/** Filter under the mouse: `show` highlights its tabs blue, `close` red. */
export interface FilterHover {
  id: string;
  kind: 'show' | 'close';
}
