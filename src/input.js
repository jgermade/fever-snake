// Keyboard, swipe and on-screen button input. Emits abstract actions:
// 'up' | 'down' | 'left' | 'right' | 'confirm' | 'pause' | 'mute'.

const KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Enter: 'confirm',
  Space: 'pause', KeyP: 'pause', Escape: 'pause',
  KeyM: 'mute',
};

export function bindInput(target, onAction) {
  window.addEventListener('keydown', (e) => {
    const action = KEYS[e.code];
    if (!action) return;
    if (e.repeat && action !== 'up' && action !== 'down' && action !== 'left' && action !== 'right') return;
    e.preventDefault();
    onAction(action, e);
  });

  let start = null;
  target.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a')) return;
    start = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  target.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dist = Math.hypot(dx, dy);
    start = null;
    if (dist < 24) {
      onAction('tap', e);
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) onAction(dx > 0 ? 'right' : 'left', e);
    else onAction(dy > 0 ? 'down' : 'up', e);
  });
  target.addEventListener('pointercancel', () => {
    start = null;
  });
  // Swiping must not scroll or zoom the page.
  target.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  for (const btn of document.querySelectorAll('[data-action]')) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onAction(btn.dataset.action, e);
    });
  }
}
