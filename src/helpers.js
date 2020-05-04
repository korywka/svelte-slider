export function pointerEvents() {
  if (document && 'ontouchstart' in document.documentElement) {
    return {
      start: 'touchstart',
      move: 'touchmove',
      end: 'touchend',
    };
  }
  return {
    start: 'mousedown',
    move: 'mousemove',
    end: 'mouseup',
  };
}

export function toPercent(n) {
  return n * 100;
}
