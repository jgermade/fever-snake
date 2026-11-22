// Lights Out: a dark cellar. Only the snake's lantern lights the way; apples
// glow faintly so you can find them.
import { GridTopology, isFullyConnected } from '../topologies/grid.js';
import { fitBoard, rng, segPos } from '../render/util.js';
import { absoluteGrid, gridUV } from './grid-input.js';

const W = 26;
const H = 16;
const SPAWN = { x: 3, y: 8 };

function makeWalls(seed) {
  const r = rng(seed);
  for (let attempt = 0; attempt < 60; attempt++) {
    const walls = [];
    for (let i = 0; i < 12; i++) {
      const horiz = r() < 0.5;
      const len = 2 + Math.floor(r() * 5);
      const x0 = 1 + Math.floor(r() * (W - 2 - (horiz ? len : 0)));
      const y0 = 1 + Math.floor(r() * (H - 2 - (horiz ? 0 : len)));
      for (let k = 0; k < len; k++) {
        const x = x0 + (horiz ? k : 0);
        const y = y0 + (horiz ? 0 : k);
        if (Math.abs(y - SPAWN.y) <= 1 && x < 20) continue; // clear start lane
        walls.push([x, y]);
      }
    }
    if (isFullyConnected(new GridTopology({ width: W, height: H, walls }), SPAWN)) return walls;
  }
  return [];
}

export default {
  id: 'lightsout',
  title: 'Lights Out',
  blurb: 'Pitch dark. Your lantern only reaches so far.',
  controls: 'Arrow keys / WASD / swipe',
  tickMs: 135,
  deathTitle: 'Game over',
  deathMessage: 'Something was there in the dark. A wall, probably.',
  hud: true,
  sfx: 'sine',

  setup(stage) {
    let layout = null;
    const walls = makeWalls(Date.now());
    const topology = new GridTopology({ width: W, height: H, walls });
    const dark = document.createElement('canvas');
    const dctx = dark.getContext('2d');

    return {
      topology,
      spawn: { cell: { ...SPAWN }, dir: 1 },
      mapAction: absoluteGrid,
      uvOf: gridUV(W, H),
      screenOf: (cell) => layout && { x: layout.ox + (cell.x + 0.5) * layout.c, y: layout.oy + (cell.y + 0.5) * layout.c },
      render(view) {
        const { ctx, width, height, dpr } = stage;
        const b = fitBoard(width - 32, height - 110, W, H);
        const c = b.cell;
        const ox = b.ox + 16;
        const oy = b.oy + 72;
        layout = { ox, oy, c };
        const s = view.snake;
        const pts = s.body.map((_, i) => segPos(s, i, view.alpha));
        const hx = ox + (pts[0].x + 0.5) * c;
        const hy = oy + (pts[0].y + 0.5) * c;

        // --- the lit scene ---
        ctx.fillStyle = '#16120e';
        ctx.fillRect(0, 0, width, height);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            ctx.fillStyle = (x * 7 + y * 13) % 5 ? '#4a3f33' : '#52463a';
            ctx.fillRect(ox + x * c, oy + y * c, c - 1, c - 1);
          }
        }
        ctx.strokeStyle = '#6b5a45';
        ctx.lineWidth = 4;
        ctx.strokeRect(ox - 2, oy - 2, b.w + 4, b.h + 4);
        for (const [x, y] of walls) {
          ctx.fillStyle = '#8c7b66';
          ctx.fillRect(ox + x * c, oy + y * c, c, c);
          ctx.fillStyle = '#a8977f';
          ctx.fillRect(ox + x * c + 2, oy + y * c + 2, c - 4, c * 0.35);
        }
        ctx.fillStyle = s.alive ? '#e9c46a' : '#c0392b';
        for (let i = pts.length - 1; i >= 0; i--) {
          ctx.beginPath();
          ctx.arc(ox + (pts[i].x + 0.5) * c, oy + (pts[i].y + 0.5) * c, c * (i === 0 ? 0.45 : 0.38), 0, Math.PI * 2);
          ctx.fill();
        }

        // --- darkness with a lantern hole and a beam ahead ---
        dark.width = Math.round(width * dpr);
        dark.height = Math.round(height * dpr);
        dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        dctx.globalCompositeOperation = 'source-over';
        dctx.fillStyle = 'rgba(3,2,8,0.97)';
        dctx.fillRect(0, 0, width, height);
        dctx.globalCompositeOperation = 'destination-out';
        const flicker = 1 + Math.sin(view.time * 13) * 0.03 + Math.sin(view.time * 7.3) * 0.03;
        const r1 = c * 3.4 * flicker;
        let g = dctx.createRadialGradient(hx, hy, 0, hx, hy, r1);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.6, 'rgba(0,0,0,0.85)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        dctx.fillStyle = g;
        dctx.fillRect(hx - r1, hy - r1, r1 * 2, r1 * 2);
        const ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][s.dir];
        const r2 = c * 8 * flicker;
        g = dctx.createRadialGradient(hx, hy, 0, hx, hy, r2);
        g.addColorStop(0, 'rgba(0,0,0,0.9)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        dctx.fillStyle = g;
        dctx.beginPath();
        dctx.moveTo(hx, hy);
        dctx.arc(hx, hy, r2, ang - 0.42, ang + 0.42);
        dctx.closePath();
        dctx.fill();
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(dark, 0, 0);
        ctx.restore();

        // Warm lantern tint
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r1);
        g.addColorStop(0, 'rgba(255,170,60,0.22)');
        g.addColorStop(1, 'rgba(255,170,60,0)');
        ctx.fillStyle = g;
        ctx.fillRect(hx - r1, hy - r1, r1 * 2, r1 * 2);
        ctx.restore();

        // Things that glow in the dark: the apple and a faint trace of the body
        if (view.apple) {
          const ax = ox + (view.apple.x + 0.5) * c;
          const ay = oy + (view.apple.y + 0.5) * c;
          const pulse = 0.75 + 0.25 * Math.sin(view.time * 3);
          ctx.save();
          ctx.shadowColor = '#7CFF6B';
          ctx.shadowBlur = 22 * pulse;
          ctx.fillStyle = `rgba(150,255,120,${0.85 * pulse})`;
          ctx.beginPath();
          ctx.arc(ax, ay, c * 0.28, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = 'rgba(233,196,106,0.18)';
        for (const p of pts) {
          ctx.beginPath();
          ctx.arc(ox + (p.x + 0.5) * c, oy + (p.y + 0.5) * c, c * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
        return { x: hx, y: hy };
      },
      dispose() {},
    };
  },
};
