// Portals: colour-coded portal pairs teleport the snake across the lab.
import { PortalGridTopology } from '../topologies/portal-grid.js';
import { fitBoard, lerp } from '../render/util.js';
import { absoluteGrid, gridUV } from './grid-input.js';

const W = 24;
const H = 16;
const PAIRS = [
  [[5, 3], [18, 12]],
  [[18, 3], [5, 12]],
  [[11, 2], [12, 13]],
];
const COLORS = ['#ff8a00', '#2fa8ff', '#3dff8a'];

/** Interpolated position of segment i; portal jumps snap instead of sliding. */
function pos(s, i, alpha) {
  const a = s.prevOf(i);
  const b = s.body[i];
  if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 1) return { x: b.x, y: b.y };
  return { x: lerp(a.x, b.x, alpha), y: lerp(a.y, b.y, alpha) };
}

export default {
  id: 'portals',
  title: 'Portals',
  blurb: 'Step into a ring, come out of its twin.',
  controls: 'Arrow keys / WASD / swipe',
  tickMs: 115,
  deathTitle: 'Test failed',
  deathMessage: 'Please do not crash into the test chamber walls.',
  hud: true,
  sfx: 'sine',

  setup(stage) {
    let layout = null;
    const topology = new PortalGridTopology({ width: W, height: H }, PAIRS);
    return {
      topology,
      spawn: { cell: { x: 3, y: 8 }, dir: 1 },
      mapAction: absoluteGrid,
      uvOf: gridUV(W, H),
      screenOf: (cell) => layout && { x: layout.ox + (cell.x + 0.5) * layout.c, y: layout.oy + (cell.y + 0.5) * layout.c },
      render(view) {
        const { ctx, width, height } = stage;
        const b = fitBoard(width - 32, height - 110, W, H);
        const c = b.cell;
        const ox = b.ox + 16;
        const oy = b.oy + 72;
        layout = { ox, oy, c };

        ctx.fillStyle = '#0b1622';
        ctx.fillRect(0, 0, width, height);
        // lab floor panels
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            ctx.fillStyle = (x + y) % 2 ? '#d9e2ea' : '#cfd9e2';
            ctx.fillRect(ox + x * c, oy + y * c, c, c);
          }
        }
        ctx.strokeStyle = 'rgba(40,60,80,0.18)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= W; x += 4) {
          ctx.beginPath();
          ctx.moveTo(ox + x * c + 0.5, oy);
          ctx.lineTo(ox + x * c + 0.5, oy + b.h);
          ctx.stroke();
        }
        for (let y = 0; y <= H; y += 4) {
          ctx.beginPath();
          ctx.moveTo(ox, oy + y * c + 0.5);
          ctx.lineTo(ox + b.w, oy + y * c + 0.5);
          ctx.stroke();
        }
        ctx.lineWidth = Math.max(3, c * 0.18);
        ctx.strokeStyle = '#3a4a5a';
        ctx.strokeRect(ox - ctx.lineWidth / 2, oy - ctx.lineWidth / 2, b.w + ctx.lineWidth, b.h + ctx.lineWidth);

        // Portals: glowing swirling rings
        PAIRS.forEach((pair, k) => {
          for (const [px, py] of pair) {
            const cx = ox + (px + 0.5) * c;
            const cy = oy + (py + 0.5) * c;
            ctx.save();
            ctx.shadowColor = COLORS[k];
            ctx.shadowBlur = 18;
            ctx.fillStyle = '#05080c';
            ctx.beginPath();
            ctx.ellipse(cx, cy, c * 0.46, c * 0.46, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = COLORS[k];
            ctx.lineWidth = c * 0.12;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.lineWidth = c * 0.07;
            for (let i = 0; i < 3; i++) {
              const a = view.time * 4 + (i * Math.PI * 2) / 3 + k;
              ctx.beginPath();
              ctx.arc(cx, cy, c * 0.28, a, a + 1.4);
              ctx.stroke();
            }
            ctx.restore();
          }
        });

        if (view.apple) {
          const ax = ox + (view.apple.x + 0.5) * c;
          const ay = oy + (view.apple.y + 0.5) * c;
          ctx.fillStyle = '#e3263a';
          ctx.beginPath();
          ctx.arc(ax, ay + c * 0.04, c * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(ax - c * 0.1, ay - c * 0.06, c * 0.08, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#2b8a3e';
          ctx.fillRect(ax - c * 0.03, ay - c * 0.38, c * 0.06, c * 0.14);
        }

        const s = view.snake;
        for (let i = s.body.length - 1; i >= 0; i--) {
          const p = pos(s, i, view.alpha);
          const inset = i === 0 ? 0.06 : 0.12;
          ctx.fillStyle = !s.alive ? '#8a2b2b' : i === 0 ? '#ff6a00' : i % 2 ? '#ffffff' : '#f1f4f7';
          ctx.strokeStyle = '#2a3440';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(ox + (p.x + inset) * c, oy + (p.y + inset) * c, c * (1 - 2 * inset), c * (1 - 2 * inset), c * 0.22);
          ctx.fill();
          ctx.stroke();
        }
        const h = pos(s, 0, view.alpha);
        const hx = ox + (h.x + 0.5) * c;
        const hy = oy + (h.y + 0.5) * c;
        ctx.fillStyle = '#1b2530';
        const look = [[0, -1], [1, 0], [0, 1], [-1, 0]][s.dir];
        ctx.beginPath();
        ctx.arc(hx + look[0] * c * 0.15, hy + look[1] * c * 0.15, c * 0.13, 0, Math.PI * 2);
        ctx.fill();
        return { x: hx, y: hy };
      },
      dispose() {},
    };
  },
};
