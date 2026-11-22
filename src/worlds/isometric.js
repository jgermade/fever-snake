// Isometric garden: a floating island drawn in 2.5D. The grid axes run
// diagonally on screen, so the controls are rotated 45 degrees.
import { GridTopology } from '../topologies/grid.js';
import { lerp } from '../render/util.js';
import { absoluteGrid, gridUV } from './grid-input.js';

const W = 13;
const H = 13;
const TREES = [[3, 3], [9, 2], [2, 9], [10, 10], [6, 4], [7, 4], [10, 5]];
const ROCKS = [[5, 10], [11, 7]];

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export default {
  id: 'isometric',
  title: 'Isometric Garden',
  blurb: 'A floating island in 2.5D. Keep off the edge.',
  controls: 'Arrows rotated 45°: up = up-right, right = down-right',
  tickMs: 140,
  deathTitle: 'Bonk',
  deathMessage: 'Trees are harder than they look. So are edges.',
  hud: true,
  sfx: 'triangle',

  setup(stage) {
    let layout = null;
    const topology = new GridTopology({ width: W, height: H, walls: [...TREES, ...ROCKS] });
    const trees = new Set(TREES.map(([x, y]) => y * W + x));

    // Grid (fx, fy) -> screen. Cell centre at (x + 0.5, y + 0.5).
    const iso = (fx, fy, z = 0) => ({
      x: layout.ox + (fx - fy) * layout.tw / 2,
      y: layout.oy + (fx + fy) * layout.th / 2 - z,
    });

    const cube = (ctx, fx, fy, size, height, color, lift = 0) => {
      const { tw, th } = layout;
      const hw = (tw / 2) * size;
      const hh = (th / 2) * size;
      const c = iso(fx + 0.5, fy + 0.5, lift);
      const hgt = height * th;
      // top
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - hh - hgt);
      ctx.lineTo(c.x + hw, c.y - hgt);
      ctx.lineTo(c.x, c.y + hh - hgt);
      ctx.lineTo(c.x - hw, c.y - hgt);
      ctx.closePath();
      ctx.fill();
      // left
      ctx.fillStyle = shade(color, 0.75);
      ctx.beginPath();
      ctx.moveTo(c.x - hw, c.y - hgt);
      ctx.lineTo(c.x, c.y + hh - hgt);
      ctx.lineTo(c.x, c.y + hh);
      ctx.lineTo(c.x - hw, c.y);
      ctx.closePath();
      ctx.fill();
      // right
      ctx.fillStyle = shade(color, 0.58);
      ctx.beginPath();
      ctx.moveTo(c.x + hw, c.y - hgt);
      ctx.lineTo(c.x, c.y + hh - hgt);
      ctx.lineTo(c.x, c.y + hh);
      ctx.lineTo(c.x + hw, c.y);
      ctx.closePath();
      ctx.fill();
      return { x: c.x, y: c.y - hgt };
    };

    return {
      topology,
      spawn: { cell: { x: 1, y: 6 }, dir: 1 },
      mapAction: absoluteGrid,
      uvOf: gridUV(W, H),
      screenOf: (cell) => layout && iso(cell.x + 0.5, cell.y + 0.5, layout.th * 0.4),
      render(view) {
        const { ctx, width, height } = stage;
        const tw = Math.floor(Math.min((width - 40) / W, ((height - 150) / (H + 3)) * 2));
        const th = tw / 2;
        layout = { tw, th, ox: width / 2, oy: (height - (W + H) * th / 2) / 2 + th * 1.2 + 20 };

        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, '#8fd3ff');
        sky.addColorStop(1, '#fbe8c8');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);
        // drifting clouds
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (let i = 0; i < 4; i++) {
          const cx = ((view.time * 12 + i * 260) % (width + 200)) - 100;
          const cy = 60 + i * 70;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 60, 16, 0, 0, Math.PI * 2);
          ctx.ellipse(cx + 30, cy - 10, 36, 14, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // island underside
        const L = iso(0, H);
        const R = iso(W, 0);
        const B = iso(W, H);
        ctx.fillStyle = '#7a5230';
        ctx.beginPath();
        ctx.moveTo(L.x, L.y);
        ctx.lineTo(B.x, B.y);
        ctx.lineTo(R.x, R.y);
        ctx.lineTo(R.x, R.y + th * 1.2);
        ctx.lineTo(B.x, B.y + th * 3);
        ctx.lineTo(L.x, L.y + th * 1.2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#5c3d22';
        ctx.beginPath();
        ctx.moveTo(B.x, B.y);
        ctx.lineTo(R.x, R.y);
        ctx.lineTo(R.x, R.y + th * 1.2);
        ctx.lineTo(B.x, B.y + th * 3);
        ctx.closePath();
        ctx.fill();

        // grass tiles
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const p0 = iso(x, y);
            const p1 = iso(x + 1, y);
            const p2 = iso(x + 1, y + 1);
            const p3 = iso(x, y + 1);
            ctx.fillStyle = (x + y) % 2 ? '#7ccf5a' : '#86d964';
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.closePath();
            ctx.fill();
          }
        }

        // Depth-sorted objects
        const s = view.snake;
        const items = [];
        for (const [x, y] of [...TREES, ...ROCKS]) items.push({ d: x + y, draw: () => {
          if (trees.has(y * W + x)) {
            cube(ctx, x, y, 0.25, 0.9, '#8a5a32');
            cube(ctx, x, y, 0.85, 0.8, '#2f9e44', th * 0.8);
            cube(ctx, x, y, 0.55, 0.6, '#40c057', th * 1.6);
          } else {
            cube(ctx, x, y, 0.75, 0.6, '#9aa3ad');
          }
        } });
        if (view.apple) {
          const a = view.apple;
          items.push({ d: a.x + a.y, draw: () => {
            const g = iso(a.x + 0.5, a.y + 0.5);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(g.x, g.y, tw * 0.22, th * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();
            const bob = Math.sin(view.time * 4) * th * 0.12;
            ctx.fillStyle = '#e03131';
            ctx.beginPath();
            ctx.arc(g.x, g.y - th * 0.55 - bob, tw * 0.17, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2b8a3e';
            ctx.fillRect(g.x - 1, g.y - th * 0.55 - bob - tw * 0.24, 3, tw * 0.09);
          } });
        }
        let headScreen = null;
        s.body.forEach((_, i) => {
          const a = s.prevOf(i);
          const b = s.body[i];
          const fx = lerp(a.x, b.x, view.alpha);
          const fy = lerp(a.y, b.y, view.alpha);
          items.push({ d: fx + fy + 0.01 * (i === 0), draw: () => {
            const color = !s.alive ? '#c92a2a' : i === 0 ? '#f08c00' : i % 2 ? '#ffd43b' : '#fcc419';
            const top = cube(ctx, fx, fy, i === 0 ? 0.78 : 0.66, i === 0 ? 0.8 : 0.6, color);
            if (i === 0) {
              headScreen = top;
              ctx.fillStyle = '#212529';
              const look = [[0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5]][s.dir]; // screen-space heading
              for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.arc(top.x + look[0] * tw * 0.12 + side * look[1] * tw * 0.1, top.y + look[1] * th * 0.2 - side * look[0] * th * 0.2, Math.max(2, tw * 0.05), 0, Math.PI * 2);
                ctx.fill();
              }
            }
          } });
        });
        items.sort((p, q) => p.d - q.d).forEach((it) => it.draw());
        return headScreen;
      },
      dispose() {},
    };
  },
};
