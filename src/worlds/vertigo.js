// Vertigo: the board turns 90° clockwise every few seconds. Arrow keys always
// mean screen directions, so the mapping to the board changes as it spins.
import { GridTopology } from '../topologies/grid.js';
import { fitBoard, segPos } from '../render/util.js';
import { gridUV } from './grid-input.js';

const S = 15;
const PERIOD = 6; // seconds between turns
const TURN = 0.9; // seconds a turn takes
const SCREEN = { up: 0, right: 1, down: 2, left: 3 };

/** Board rotation in quarter turns (fractional while turning). */
function quarters(t) {
  const base = Math.floor(t / PERIOD);
  const k = Math.min(1, Math.max(0, (t % PERIOD - (PERIOD - TURN)) / TURN));
  return base + k * k * (3 - 2 * k);
}

export default {
  id: 'vertigo',
  title: 'Vertigo',
  blurb: 'The board turns every few seconds. Arrows follow the screen.',
  controls: 'Arrow keys are screen directions — the board spins',
  tickMs: 135,
  deathTitle: 'Dizzy',
  deathMessage: 'The world spun. You did not.',
  hud: true,
  sfx: 'triangle',

  setup(stage) {
    let layout = null;
    const topology = new GridTopology({ width: S, height: S, walls: [[7, 7], [3, 11], [11, 3]] });
    const control = { quarter: 0, rot: 0 };
    const rotate = (x, y) => {
      const a = control.rot * Math.PI / 2;
      const cx = layout.ox + layout.w / 2;
      const cy = layout.oy + layout.h / 2;
      const dx = x - cx;
      const dy = y - cy;
      return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
    };
    return {
      topology,
      control,
      spawn: { cell: { x: 2, y: 5 }, dir: 1 },
      // screen direction s on a board turned q quarters clockwise = board direction s - q
      mapAction: (action) => (action in SCREEN ? (SCREEN[action] - control.quarter + 8) % 4 : null),
      placeMap: (action) => (action in SCREEN ? (SCREEN[action] - control.quarter + 8) % 4 : null),
      uvOf: gridUV(S, S),
      screenOf: (cell) => layout && rotate(layout.ox + (cell.x + 0.5) * layout.c, layout.oy + (cell.y + 0.5) * layout.c),
      render(view) {
        const { ctx, width, height } = stage;
        control.rot = quarters(view.worldTime);
        control.quarter = Math.round(control.rot) % 4;
        const b = fitBoard(width - 40, height - 120, S, S);
        const c = b.cell;
        const ox = b.ox + 20;
        const oy = b.oy + 70;
        layout = { ox, oy, c, w: b.w, h: b.h };
        const cx = ox + b.w / 2;
        const cy = oy + b.h / 2;

        // op-art spiral background
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);
        const maxR = Math.hypot(width, height);
        for (let i = 0; i < 24; i++) {
          ctx.fillStyle = i % 2 ? '#f2f2f2' : '#111';
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          const a = (i / 24) * Math.PI * 2 - view.time * 0.25;
          ctx.arc(cx, cy, maxR, a, a + Math.PI / 12);
          ctx.closePath();
          ctx.fill();
        }

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(control.rot * Math.PI / 2);
        ctx.translate(-cx, -cy);
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 30;
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(ox - 6, oy - 6, b.w + 12, b.h + 12);
        ctx.shadowBlur = 0;
        for (let y = 0; y < S; y++) {
          for (let x = 0; x < S; x++) {
            ctx.fillStyle = (x + y) % 2 ? '#e9e9e9' : '#fafafa';
            ctx.fillRect(ox + x * c, oy + y * c, c, c);
          }
        }
        // "this way up" arrow on the board
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.moveTo(cx, oy + c);
        ctx.lineTo(cx + c * 2, oy + c * 3);
        ctx.lineTo(cx - c * 2, oy + c * 3);
        ctx.fill();
        ctx.fillStyle = '#111';
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (topology.isWall(x, y)) ctx.fillRect(ox + x * c + 2, oy + y * c + 2, c - 4, c - 4);
        if (view.apple) {
          ctx.fillStyle = '#e63946';
          ctx.beginPath();
          ctx.arc(ox + (view.apple.x + 0.5) * c, oy + (view.apple.y + 0.5) * c, c * 0.32, 0, Math.PI * 2);
          ctx.fill();
        }
        const s = view.snake;
        const pts = s.body.map((_, i) => segPos(s, i, view.alpha));
        ctx.strokeStyle = s.alive ? '#111' : '#e63946';
        ctx.lineWidth = c * 0.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, ox + (p.x + 0.5) * c, oy + (p.y + 0.5) * c));
        if (pts.length === 1) ctx.lineTo(ox + (pts[0].x + 0.5) * c + 0.01, oy + (pts[0].y + 0.5) * c);
        ctx.stroke();
        ctx.strokeStyle = '#fafafa';
        ctx.lineWidth = c * 0.12;
        ctx.setLineDash([c * 0.2, c * 0.25]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        return rotate(ox + (pts[0].x + 0.5) * c, oy + (pts[0].y + 0.5) * c);
      },
      dispose() {},
    };
  },
};
