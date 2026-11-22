// Black Hole: everything is drawn through a gravitational-lensing warp, the
// event horizon in the middle is deadly, and time dilates near it — the snake
// slows down the closer it gets.
import { GridTopology } from '../topologies/grid.js';
import { fitBoard, rng, segPos } from '../render/util.js';
import { absoluteGrid, gridUV } from './grid-input.js';

const W = 24;
const H = 16;
const CX = W / 2;
const CY = H / 2;
const HORIZON = 2.2; // cells

const distC = (x, y) => Math.hypot(x + 0.5 - CX, y + 0.5 - CY);

export default {
  id: 'blackhole',
  title: 'Black Hole',
  blurb: 'Space bends around the singularity. Time slows down near it.',
  controls: 'Arrow keys / WASD / swipe · time runs slower near the hole',
  tickMs: 115,
  deathTitle: 'Spaghettified',
  deathMessage: 'You crossed the event horizon. Nothing gets out. Not even high scores.',
  hud: true,
  sfx: 'sawtooth',

  setup(stage) {
    let layout = null;
    const walls = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (distC(x, y) < HORIZON) walls.push([x, y]);
    const topology = new GridTopology({ width: W, height: H, walls });
    const r = rng(11);
    const stars = Array.from({ length: 220 }, () => ({ x: r() * W, y: r() * H, b: 0.3 + r() * 0.7 }));

    /** Lensing: points are pushed out from the centre, r' = sqrt(r² + k²). */
    const warp = (gx, gy) => {
      const dx = gx - CX;
      const dy = gy - CY;
      const d = Math.hypot(dx, dy) || 1e-6;
      const k = HORIZON * 1.15;
      const d2 = Math.sqrt(d * d + k * k);
      const sw = Math.atan2(dy, dx) + 0.35 / (d * 0.5 + 0.6); // frame dragging swirl
      return { x: layout.cx + Math.cos(sw) * d2 * layout.c, y: layout.cy + Math.sin(sw) * d2 * layout.c, s: Math.min(1.3, d2 / d) };
    };

    return {
      topology,
      spawn: { cell: { x: 2, y: 2 }, dir: 1 },
      mapAction: absoluteGrid,
      uvOf: gridUV(W, H),
      screenOf: (cell) => layout && warp(cell.x + 0.5, cell.y + 0.5),
      // gravitational time dilation: up to ~1.8x slower right next to the horizon
      tickScale: (snake) => {
        const d = distC(snake.head.x, snake.head.y) - HORIZON;
        return 1 + 0.8 / Math.max(1, d * d * 0.35 + 1);
      },
      render(view) {
        const { ctx, width, height } = stage;
        const b = fitBoard(width - 32, height - 110, W + 3, H + 3);
        const c = b.cell;
        layout = { c, cx: width / 2, cy: b.oy + 72 + b.h / 2 - c };

        ctx.fillStyle = '#02010a';
        ctx.fillRect(0, 0, width, height);
        for (const st of stars) {
          const p = warp(st.x, st.y);
          ctx.fillStyle = `rgba(220,230,255,${st.b})`;
          ctx.fillRect(p.x, p.y, 1.6, 1.6);
        }
        // warped grid
        ctx.strokeStyle = 'rgba(120,140,255,0.22)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= W; x++) {
          ctx.beginPath();
          for (let y = 0; y <= H; y += 0.25) {
            const p = warp(x, y);
            if (y) ctx.lineTo(p.x, p.y);
            else ctx.moveTo(p.x, p.y);
          }
          ctx.stroke();
        }
        for (let y = 0; y <= H; y++) {
          ctx.beginPath();
          for (let x = 0; x <= W; x += 0.25) {
            const p = warp(x, y);
            if (x) ctx.lineTo(p.x, p.y);
            else ctx.moveTo(p.x, p.y);
          }
          ctx.stroke();
        }

        // accretion disk + photon ring + horizon
        const hc = { x: layout.cx, y: layout.cy };
        const hr = HORIZON * 1.15 * c;
        ctx.save();
        ctx.translate(hc.x, hc.y);
        ctx.rotate(view.time * 0.6);
        for (let i = 0; i < 3; i++) {
          const g = ctx.createRadialGradient(0, 0, hr * 0.9, 0, 0, hr * (2.4 - i * 0.3));
          g.addColorStop(0, 'rgba(255,200,120,0.9)');
          g.addColorStop(0.4, 'rgba(255,110,40,0.45)');
          g.addColorStop(1, 'rgba(120,20,80,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(0, 0, hr * (2.4 - i * 0.3), hr * (0.75 - i * 0.12), i * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        ctx.shadowColor = '#ffb070';
        ctx.shadowBlur = 30;
        ctx.strokeStyle = 'rgba(255,220,170,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(hc.x, hc.y, hr * 1.02, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(hc.x, hc.y, hr, 0, Math.PI * 2);
        ctx.fill();

        if (view.apple) {
          const p = warp(view.apple.x + 0.5, view.apple.y + 0.5);
          ctx.fillStyle = '#7CFFCB';
          ctx.shadowColor = '#7CFFCB';
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(p.x, p.y, c * 0.3 * p.s, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        const s = view.snake;
        let head = null;
        for (let i = s.body.length - 1; i >= 0; i--) {
          const g = segPos(s, i, view.alpha);
          const p = warp(g.x + 0.5, g.y + 0.5);
          // segments near the hole stretch (spaghettification, mildly)
          ctx.fillStyle = !s.alive ? '#ff4d6d' : i === 0 ? '#e0e7ff' : `hsl(${230 + i * 4}, 80%, ${70 - Math.min(30, i)}%)`;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, c * 0.4 * p.s, c * 0.4 / p.s, Math.atan2(p.y - hc.y, p.x - hc.x), 0, Math.PI * 2);
          ctx.fill();
          if (i === 0) head = p;
        }
        return head && { x: head.x, y: head.y };
      },
      dispose() {},
    };
  },
};
