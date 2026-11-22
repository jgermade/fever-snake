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

/**
 * Turns a finger (or mouse drag) path into direction actions *while* it
 * moves, so the player can steer continuously without lifting the finger:
 * drawing an "L" emits "down" then "right".
 *
 * Every time the pointer has travelled `step` pixels from the anchor, the
 * dominant axis gives an action and the anchor moves to the current point.
 * Repeating the same action needs a longer stroke (`repeatSteps` x `step`),
 * which matters only for relative controls (turn left twice = U-turn).
 */
export class SwipeTracker {
  constructor({ step = 22, repeatSteps = 3 } = {}) {
    this.step = step;
    this.repeatSteps = repeatSteps;
    this.anchor = null;
  }

  start(x, y) {
    this.anchor = { x, y };
    this.last = null;
    this.sameRun = 0;
    this.moved = false;
  }

  /** @returns {string|null} an action to emit, if any */
  move(x, y) {
    if (!this.anchor) return null;
    const dx = x - this.anchor.x;
    const dy = y - this.anchor.y;
    if (Math.hypot(dx, dy) < this.step) return null;
    this.moved = true;
    this.anchor = { x, y };
    const action = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    if (action === this.last) {
      this.sameRun += 1;
      if (this.sameRun < this.repeatSteps) return null;
    }
    this.last = action;
    this.sameRun = 0;
    return action;
  }

  /** @returns {'tap'|null} */
  end() {
    const tap = this.anchor && !this.moved ? 'tap' : null;
    this.anchor = null;
    return tap;
  }
}

export function bindInput(target, onAction) {
  window.addEventListener('keydown', (e) => {
    const action = KEYS[e.code];
    if (!action) return;
    if (e.repeat && action !== 'up' && action !== 'down' && action !== 'left' && action !== 'right') return;
    e.preventDefault();
    onAction(action, e);
  });

  const swipe = new SwipeTracker();
  let pointerId = null;
  target.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a') || pointerId !== null) return;
    pointerId = e.pointerId;
    // Shorter strokes on small screens.
    swipe.step = Math.max(14, Math.min(26, Math.min(innerWidth, innerHeight) * 0.045));
    swipe.start(e.clientX, e.clientY);
    target.setPointerCapture?.(e.pointerId);
  });
  target.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    // Coalesced events give the full path even when frames are slow.
    const events = e.getCoalescedEvents?.() ?? [];
    for (const p of events.length ? events : [e]) {
      const action = swipe.move(p.clientX, p.clientY);
      if (action) onAction(action, e);
    }
  });
  const finish = (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    const tap = e.type === 'pointerup' ? swipe.end() : (swipe.end(), null);
    if (tap) onAction(tap, e);
  };
  target.addEventListener('pointerup', finish);
  target.addEventListener('pointercancel', finish);
  // Swiping must not scroll or zoom the page.
  target.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  for (const btn of document.querySelectorAll('[data-action]')) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onAction(btn.dataset.action, e);
    });
  }
}
