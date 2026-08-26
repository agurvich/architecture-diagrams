/** Keeps a floating box's top-left corner on-screen, margin px clear of every edge, without letting it fly off past a viewport smaller than the box itself. */
export function clampToViewport(
  x: number,
  y: number,
  width: number,
  height: number,
  margin: number,
): { left: number; top: number } {
  const maxLeft = window.innerWidth - width - margin;
  const maxTop = window.innerHeight - height - margin;
  return {
    left: Math.min(x, Math.max(maxLeft, margin)),
    top: Math.min(y, Math.max(maxTop, margin)),
  };
}
