// Klein Bottle: left/right edges are glued normally, top/bottom are glued with
// a mirror flip — the classic square diagram from a topology class, in chalk.
import { MobiusTopology } from '../topologies/mobius.js';
import { fitBoard } from '../render/util.js';
import { absoluteGrid, gridUV } from './grid-input.js';

const W = 22;
const H = 14;
const CHALK = '#f1f1e6';
const FONT = '"Chalkboard SE", "Comic Sans MS", "Segoe Print", cursive';

/** Interpolated position, ignoring the jump when crossing a glued edge. */
function pos(s, i, a) {
  const p = s.prevOf(i);
  const q = s.body[i];
  if (Math.abs(p.x - q.x) + Math.abs(p.y - q.y) > 1) return { x: q.x, y: q.y };
  return { x: p.x + (q.x - p.x) * a, y: p.y + (q.y - p.y) * a };
}

function arrow(ctx, x1, y1, x2, y2, heads) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  for (let k = 0; k < heads; k++) {
    const mx = (x1 + x2) / 2 + Math.cos(a) * (k * 14 - (heads - 1) * 7);
    const my = (y1 + y2) / 2 + Math.sin(a) * (k * 14 - (heads - 1) * 7);
    ctx.beginPath();
    ctx.moveTo(mx - Math.cos(a - 0.5) * 12, my - Math.sin(a - 0.5) * 12);
    ctx.lineTo(mx, my);
    ctx.lineTo(mx - Math.cos(a + 0.5) * 12, my - Math.sin(a + 0.5) * 12);
    ctx.stroke();
  }
}

export default {
  id: 'klein',
  title: 'Klein Bottle',
  blurb: 'Left and right are glued. Top and bottom are glued — upside down.',
  controls: 'Arrow keys / WASD / swipe · edges wrap (top/bottom mirrored)',
  tickMs: 120,
  deathTitle: 'Q.E.D.',
  deathMessage: 'The snake has proven it can intersect itself. In 3D. Unlike the bottle.',
  hud: true,
  sfx: 'triangle',

  setup(stage) {
    let layout = null;
    const topology = new MobiusTopology({ width: W, height: H, wrapX: true, walls: [[10, 6], [11, 6], [10, 7], [11, 7]] });
    return {
      topology,
      spawn: { cell: { x: 3, y: 3 }, dir: 1 },
      mapAction: absoluteGrid,
      uvOf: gridUV(W, H),
      screenOf: (cell) => layout && { x: layout.ox + (cell.x + 0.5) * layout.c, y: layout.oy + (cell.y + 0.5) * layout.c },
      render(view) {
        const { ctx, width, height } = stage;
        const b = fitBoard(width - 90, height - 150, W, H);
        const c = b.cell;
        const ox = b.ox + 45;
        const oy = b.oy + 90;
        layout = { ox, oy, c };

        // chalkboard
        ctx.fillStyle = '#23372b';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        for (let i = 0; i < 60; i++) ctx.fillRect((i * 97) % width, (i * 53) % height, 140, 2);
        ctx.strokeStyle = 'rgba(241,241,230,0.12)';
        ctx.lineWidth = 1;
        for (let x = 1; x < W; x++) {
          ctx.beginPath();
          ctx.moveTo(ox + x * c, oy);
          ctx.lineTo(ox + x * c, oy + b.h);
          ctx.stroke();
        }
        for (let y = 1; y < H; y++) {
          ctx.beginPath();
          ctx.moveTo(ox, oy + y * c);
          ctx.lineTo(ox + b.w, oy + y * c);
          ctx.stroke();
        }
        // glued edges: single arrows (same direction) left/right, double arrows (opposite) top/bottom
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#7fd3ff';
        arrow(ctx, ox - 10, oy + b.h, ox - 10, oy, 1);
        arrow(ctx, ox + b.w + 10, oy + b.h, ox + b.w + 10, oy, 1);
        ctx.strokeStyle = '#ff9d9d';
        arrow(ctx, ox, oy - 10, ox + b.w, oy - 10, 2);
        arrow(ctx, ox + b.w, oy + b.h + 10, ox, oy + b.h + 10, 2);
        ctx.fillStyle = CHALK;
        ctx.font = `${Math.max(14, c * 0.6)}px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.fillText('K = [0,1]² / ~', ox, oy - 26);

        // the "bottle neck" obstacle in the middle
        ctx.strokeStyle = CHALK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(ox + 11 * c, oy + 7 * c, c * 0.95, c * 0.95, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        for (let k = -3; k <= 3; k++) {
          ctx.moveTo(ox + 11 * c + k * c * 0.25 - c * 0.4, oy + 7 * c + c * 0.6);
          ctx.lineTo(ox + 11 * c + k * c * 0.25 + c * 0.4, oy + 7 * c - c * 0.6);
        }
        ctx.stroke();

        if (view.apple) {
          ctx.strokeStyle = '#ffb3b3';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(ox + (view.apple.x + 0.5) * c, oy + (view.apple.y + 0.55) * c, c * 0.3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ox + (view.apple.x + 0.5) * c, oy + (view.apple.y + 0.25) * c);
          ctx.lineTo(ox + (view.apple.x + 0.62) * c, oy + (view.apple.y + 0.05) * c);
          ctx.stroke();
        }

        const s = view.snake;
        const head = pos(s, 0, view.alpha);
        // ghost of the head on the glued edge it is about to cross
        const ghosts = [];
        if (head.y < 1) ghosts.push({ x: W - 1 - head.x, y: head.y + H });
        if (head.y > H - 2) ghosts.push({ x: W - 1 - head.x, y: head.y - H });
        if (head.x < 1) ghosts.push({ x: head.x + W, y: head.y });
        if (head.x > W - 2) ghosts.push({ x: head.x - W, y: head.y });
        ctx.fillStyle = 'rgba(241,241,230,0.25)';
        for (const g of ghosts) {
          ctx.beginPath();
          ctx.arc(ox + (g.x + 0.5) * c, oy + (g.y + 0.5) * c, c * 0.38, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = s.body.length - 1; i >= 0; i--) {
          const p = pos(s, i, view.alpha);
          ctx.strokeStyle = s.alive ? CHALK : '#ff9d9d';
          ctx.fillStyle = i === 0 ? 'rgba(241,241,230,0.85)' : 'rgba(241,241,230,0.15)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ox + (p.x + 0.5) * c, oy + (p.y + 0.5) * c, c * (i === 0 ? 0.42 : 0.36), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        return { x: ox + (head.x + 0.5) * c, y: oy + (head.y + 0.5) * c };
      },
      dispose() {},
    };
  },
};
