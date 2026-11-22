// World 8: a pencil doodle on lined notebook paper. Lines "boil" like a
// hand-drawn animation.
import { GridTopology } from '../topologies/grid.js';
import { fitBoard, rng, segPos } from '../render/util.js';
import { absoluteGrid, gridUV } from './grid-input.js';

const W = 22;
const H = 14;
const HAND = '"Comic Sans MS", "Chalkboard SE", "Comic Neue", "Marker Felt", cursive';

const ROCKS = [[7, 3], [8, 3], [15, 10], [15, 11], [16, 10], [5, 11], [17, 3], [11, 4]];

function jitter(seed, i, amount) {
  const r = rng(seed * 9973 + i * 131);
  return (r() - 0.5) * amount;
}

function wobblyLine(ctx, pts, seed, amount) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = x + jitter(seed, i * 2, amount);
    const jy = y + jitter(seed, i * 2 + 1, amount);
    if (i === 0) ctx.moveTo(jx, jy);
    else ctx.lineTo(jx, jy);
  });
  ctx.stroke();
}

function scribbleCircle(ctx, cx, cy, r, seed, turns = 1.15) {
  const pts = [];
  const n = 18;
  for (let i = 0; i <= n * turns; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + jitter(seed, i, 0.18));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  wobblyLine(ctx, pts, seed, r * 0.05);
}

export default {
  id: 'doodle',
  title: 'Notebook',
  blurb: 'Someone drew a snake in the margin of their homework.',
  controls: 'Arrow keys / WASD / swipe',
  tickMs: 110,
  deathTitle: 'oops!',
  deathMessage: 'The eraser got you.',
  hud: true,
  sfx: 'triangle',

  setup(stage) {
    let layout = null;
    const topology = new GridTopology({ width: W, height: H, walls: ROCKS });
    return {
      topology,
      spawn: { cell: { x: 3, y: 7 }, dir: 1 },
      mapAction: absoluteGrid,
      uvOf: gridUV(W, H),
      /** Screen position of a cell, from the last rendered layout. */
      screenOf: (cell) => layout && ({ x: layout.ox + (cell.x + 0.5) * layout.c, y: layout.oy + (cell.y + 0.5) * layout.c }),
      render(view) {
        const { ctx, width, height } = stage;
        const seed = Math.floor(view.time * 7);
        const b = fitBoard(width - 80, height - 140, W, H);
        const c = b.cell;
        const ox = b.ox + 60;
        const oy = b.oy + 90;

        ctx.fillStyle = '#fdfaf0';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(80,130,220,0.35)';
        ctx.lineWidth = 1;
        for (let y = oy % c; y < height; y += c) {
          ctx.beginPath();
          ctx.moveTo(0, y + 0.5);
          ctx.lineTo(width, y + 0.5);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(230,60,60,0.55)';
        ctx.beginPath();
        ctx.moveTo(ox - 24, 0);
        ctx.lineTo(ox - 24, height);
        ctx.stroke();
        // hole punches
        ctx.fillStyle = '#e9e4d4';
        for (let y = height * 0.2; y < height; y += height * 0.3) {
          ctx.beginPath();
          ctx.arc(18, y, 8, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Hand-drawn border
        ctx.strokeStyle = '#3a3a48';
        ctx.lineWidth = 2.5;
        wobblyLine(ctx, [[ox, oy], [ox + b.w / 2, oy], [ox + b.w, oy], [ox + b.w, oy + b.h / 2], [ox + b.w, oy + b.h],
          [ox + b.w / 2, oy + b.h], [ox, oy + b.h], [ox, oy + b.h / 2], [ox, oy]], seed, 3);

        // Rocks
        ctx.lineWidth = 2;
        ROCKS.forEach(([x, y], i) => {
          ctx.fillStyle = 'rgba(90,90,100,0.18)';
          ctx.fillRect(ox + x * c + 3, oy + y * c + 3, c - 6, c - 6);
          ctx.strokeStyle = '#555';
          scribbleCircle(ctx, ox + (x + 0.5) * c, oy + (y + 0.5) * c, c * 0.38, seed + i, 1.05);
          // hatching
          ctx.beginPath();
          for (let k = 0; k < 3; k++) {
            const t = (k + 1) / 4;
            ctx.moveTo(ox + (x + t) * c - c * 0.15, oy + (y + 0.72) * c);
            ctx.lineTo(ox + (x + t) * c + c * 0.15, oy + (y + 0.28) * c);
          }
          ctx.stroke();
        });

        // Apple
        if (view.apple) {
          const ax = ox + (view.apple.x + 0.5) * c;
          const ay = oy + (view.apple.y + 0.55) * c;
          ctx.fillStyle = 'rgba(235,50,50,0.55)';
          ctx.beginPath();
          ctx.arc(ax, ay, c * 0.33, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#c81e1e';
          ctx.lineWidth = 2.2;
          scribbleCircle(ctx, ax, ay, c * 0.35, seed + 99, 1.3);
          ctx.strokeStyle = '#2f8a2f';
          wobblyLine(ctx, [[ax, ay - c * 0.3], [ax + c * 0.05, ay - c * 0.5], [ax + c * 0.25, ay - c * 0.5]], seed, 1.5);
        }

        // Snake body: thick graphite stroke with a lighter inner line
        const s = view.snake;
        const pts = s.body.map((_, i) => {
          const p = segPos(s, i, view.alpha);
          return [ox + (p.x + 0.5) * c, oy + (p.y + 0.5) * c];
        });
        if (pts.length === 1) pts.push([pts[0][0] + 0.1, pts[0][1]]);
        ctx.strokeStyle = s.alive ? '#2d6a2d' : '#8a2d2d';
        ctx.lineWidth = c * 0.62;
        wobblyLine(ctx, pts, seed, 1.5);
        ctx.strokeStyle = s.alive ? '#8fd18f' : '#e08a8a';
        ctx.lineWidth = c * 0.32;
        wobblyLine(ctx, pts, seed + 1, 2);

        // Googly eyes
        const [hx, hy] = pts[0];
        const look = [[0, -1], [1, 0], [0, 1], [-1, 0]][s.dir];
        const side = [-look[1], look[0]];
        for (const k of [-1, 1]) {
          const ex = hx + side[0] * c * 0.2 * k + look[0] * c * 0.1;
          const ey = hy + side[1] * c * 0.2 * k + look[1] * c * 0.1;
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#222';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ex, ey, c * 0.17, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.arc(ex + look[0] * c * 0.06 + jitter(seed, k, 2), ey + look[1] * c * 0.06, c * 0.07, 0, Math.PI * 2);
          ctx.fill();
        }

        // Title scribble
        ctx.fillStyle = '#2a3a8a';
        ctx.font = `${Math.max(18, c * 0.9)}px ${HAND}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.save();
        ctx.translate(ox, oy - 14);
        ctx.rotate(-0.02);
        ctx.fillText("my snake :)", 0, 0);
        ctx.restore();
        layout = { ox, oy, c };
        return { x: hx, y: hy };
      },
      dispose() {},
    };
  },
};
