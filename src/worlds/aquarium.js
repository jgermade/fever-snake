// Aquarium: an eel in a fish tank. Kelp grows from the sand; bubbles rise and
// fish swim past (decoration only).
import { GridTopology } from '../topologies/grid.js';
import { fitBoard, rng, segPos } from '../render/util.js';
import { absoluteGrid, gridUV } from './grid-input.js';

const W = 24;
const H = 15;
const KELP = [[4, 4], [9, 5], [14, 3], [19, 5], [22, 3]]; // [x, height] from the bottom
const CORAL = [[11, 2], [12, 2], [6, 10], [17, 9]];

export default {
  id: 'aquarium',
  title: 'Aquarium',
  blurb: 'An eel in a fish tank. Mind the kelp and the coral.',
  controls: 'Arrow keys / WASD / swipe',
  tickMs: 125,
  deathTitle: 'Blub',
  deathMessage: 'The eel got tangled in the scenery.',
  hud: true,
  sfx: 'sine',

  setup(stage) {
    let layout = null;
    const walls = [...CORAL];
    for (const [x, h] of KELP) for (let k = 0; k < h; k++) walls.push([x, H - 1 - k]);
    const topology = new GridTopology({ width: W, height: H, walls });
    const r = rng(Date.now());
    const bubbles = Array.from({ length: 40 }, () => ({ x: r(), y: r(), s: 0.3 + r() * 0.7 }));
    const fish = Array.from({ length: 5 }, (_, i) => ({ y: 0.1 + r() * 0.6, v: 0.03 + r() * 0.05, dir: i % 2 ? 1 : -1, hue: Math.floor(r() * 360), off: r() }));

    return {
      topology,
      spawn: { cell: { x: 1, y: 4 }, dir: 1 },
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
        const t = view.time;

        const water = ctx.createLinearGradient(0, 0, 0, height);
        water.addColorStop(0, '#0fa3b1');
        water.addColorStop(1, '#033f63');
        ctx.fillStyle = water;
        ctx.fillRect(0, 0, width, height);
        // light rays
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
          const x = ((i / 6) * width + Math.sin(t * 0.3 + i) * 40);
          const g = ctx.createLinearGradient(x, 0, x + 80, height);
          g.addColorStop(0, 'rgba(255,255,255,0.10)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + 50, 0);
          ctx.lineTo(x + 200, height);
          ctx.lineTo(x + 90, height);
          ctx.fill();
        }
        ctx.restore();
        // sand
        ctx.fillStyle = '#e9c46a';
        ctx.beginPath();
        ctx.moveTo(0, oy + b.h);
        for (let x = 0; x <= width; x += 20) ctx.lineTo(x, oy + b.h + Math.sin(x * 0.02) * 6);
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.fill();
        // glass outline
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 3;
        ctx.strokeRect(ox - 2, oy - 2, b.w + 4, b.h + 4);

        // fish (behind everything gameplay-related)
        for (const f of fish) {
          const p = ((t * f.v + f.off) % 1.2) - 0.1;
          const x = f.dir > 0 ? p * width : width - p * width;
          const y = f.y * height + Math.sin(t * 2 + f.off * 9) * 8;
          ctx.fillStyle = `hsla(${f.hue},80%,60%,0.55)`;
          ctx.beginPath();
          ctx.ellipse(x, y, 16, 8, 0, 0, Math.PI * 2);
          ctx.moveTo(x - f.dir * 14, y);
          ctx.lineTo(x - f.dir * 26, y - 8);
          ctx.lineTo(x - f.dir * 26, y + 8);
          ctx.fill();
        }

        // kelp: swaying strands over the blocked cells
        for (const [x, h] of KELP) {
          ctx.strokeStyle = '#2d6a4f';
          ctx.lineWidth = c * 0.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (let k = 0; k <= h; k++) {
            const sway = Math.sin(t * 1.5 + x + k * 0.6) * c * 0.12 * (k / h);
            const px = ox + (x + 0.5) * c + sway;
            const py = oy + (H - k) * c - (k === 0 ? 0 : c * 0.5);
            if (k) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          }
          ctx.stroke();
          ctx.fillStyle = '#40916c';
          for (let k = 1; k <= h; k++) {
            const px = ox + (x + 0.5) * c + Math.sin(t * 1.5 + x + k * 0.6) * c * 0.12 * (k / h);
            const py = oy + (H - k + 0.5) * c;
            ctx.beginPath();
            ctx.ellipse(px + c * 0.25, py, c * 0.22, c * 0.1, 0.5, 0, Math.PI * 2);
            ctx.ellipse(px - c * 0.25, py - c * 0.2, c * 0.22, c * 0.1, -0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        for (const [x, y] of CORAL) {
          ctx.fillStyle = '#ef476f';
          const px = ox + x * c;
          const py = oy + y * c;
          ctx.beginPath();
          ctx.roundRect(px + c * 0.1, py + c * 0.1, c * 0.8, c * 0.8, c * 0.3);
          ctx.fill();
          ctx.fillStyle = '#ffd6e0';
          for (let k = 0; k < 4; k++) ctx.fillRect(px + c * (0.25 + (k % 2) * 0.35), py + c * (0.25 + Math.floor(k / 2) * 0.35), c * 0.1, c * 0.1);
        }

        if (view.apple) {
          // a pearl in an open shell
          const ax = ox + (view.apple.x + 0.5) * c;
          const ay = oy + (view.apple.y + 0.5) * c;
          ctx.fillStyle = '#f4a261';
          ctx.beginPath();
          ctx.ellipse(ax, ay + c * 0.15, c * 0.4, c * 0.18, 0, 0, Math.PI);
          ctx.fill();
          const g = ctx.createRadialGradient(ax - c * 0.06, ay - c * 0.06, 1, ax, ay, c * 0.22);
          g.addColorStop(0, '#fff');
          g.addColorStop(1, '#cfd8dc');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(ax, ay, c * 0.2 * (1 + Math.sin(t * 4) * 0.05), 0, Math.PI * 2);
          ctx.fill();
        }

        // Eel
        const s = view.snake;
        const pts = s.body.map((_, i) => {
          const p = segPos(s, i, view.alpha);
          const wob = Math.sin(t * 6 - i * 0.8) * c * 0.06;
          return [ox + (p.x + 0.5) * c + wob, oy + (p.y + 0.5) * c + wob];
        });
        if (pts.length === 1) pts.push([pts[0][0] + 0.1, pts[0][1]]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = s.alive ? '#386641' : '#6a040f';
        ctx.lineWidth = c * 0.7;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.strokeStyle = s.alive ? '#a7c957' : '#d00000';
        ctx.lineWidth = c * 0.25;
        ctx.stroke();
        const [hx, hy] = pts[0];
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(hx, hy - c * 0.12, c * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(hx, hy - c * 0.12, c * 0.06, 0, Math.PI * 2);
        ctx.fill();

        // bubbles in front
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        for (const bb of bubbles) {
          const y = (((bb.y - t * 0.05 * bb.s) % 1) + 1) % 1;
          ctx.beginPath();
          ctx.arc(bb.x * width + Math.sin(t * 2 + bb.x * 20) * 6, y * height, 2 + bb.s * 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        return { x: hx, y: hy };
      },
      dispose() {},
    };
  },
};
