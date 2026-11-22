// World 1: classic snake drawn with neon glow. Borders are deadly.
import { GridTopology } from '../topologies/grid.js';
import { fitBoard, segPos } from '../render/util.js';
import { absoluteGrid, gridUV } from './grid-input.js';

const W = 24;
const H = 16;

export default {
  id: 'neon',
  title: 'Neon Classic',
  blurb: 'The original. Do not touch the walls.',
  controls: 'Arrow keys / WASD / swipe',
  tickMs: 115,
  deathTitle: 'Game over',
  deathMessage: 'Your neon trail fades into the grid.',
  hud: true,
  sfx: 'sawtooth',

  setup(stage) {
    let layout = null;
    const topology = new GridTopology({ width: W, height: H });
    return {
      topology,
      spawn: { cell: { x: 4, y: H >> 1 }, dir: 1 },
      mapAction: absoluteGrid,
      uvOf: gridUV(W, H),
      /** Screen position of a cell, from the last rendered layout. */
      screenOf: (cell) => layout && ({ x: layout.ox + (cell.x + 0.5) * layout.c, y: layout.oy + (cell.y + 0.5) * layout.c }),
      render(view) {
        const { ctx, width, height } = stage;
        const b = fitBoard(width - 32, height - 120, W, H);
        const ox = b.ox + 16;
        const oy = b.oy + 72;
        const c = b.cell;

        ctx.fillStyle = '#07010f';
        ctx.fillRect(0, 0, width, height);

        // Synthwave horizon glow
        const g = ctx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, 'rgba(255,0,170,0.10)');
        g.addColorStop(1, 'rgba(0,240,255,0.08)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(0,240,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= W; x++) {
          ctx.moveTo(ox + x * c + 0.5, oy);
          ctx.lineTo(ox + x * c + 0.5, oy + b.h);
        }
        for (let y = 0; y <= H; y++) {
          ctx.moveTo(ox, oy + y * c + 0.5);
          ctx.lineTo(ox + b.w, oy + y * c + 0.5);
        }
        ctx.stroke();

        ctx.save();
        ctx.shadowColor = '#ff00aa';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#ff2fb9';
        ctx.lineWidth = 3;
        ctx.strokeRect(ox - 2, oy - 2, b.w + 4, b.h + 4);

        // Apple
        if (view.apple) {
          const pulse = 0.8 + 0.2 * Math.sin(view.time * 6);
          ctx.shadowColor = '#ffe600';
          ctx.shadowBlur = 25 * pulse;
          ctx.fillStyle = '#fff36b';
          ctx.beginPath();
          ctx.arc(ox + (view.apple.x + 0.5) * c, oy + (view.apple.y + 0.5) * c, c * 0.3 * pulse, 0, Math.PI * 2);
          ctx.fill();
        }

        // Snake as a glowing tube
        const s = view.snake;
        const pts = s.body.map((_, i) => segPos(s, i, view.alpha));
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = s.alive ? '#00f0ff' : '#ff3355';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = c * 0.55;
        ctx.beginPath();
        pts.forEach((p, i) => {
          const x = ox + (p.x + 0.5) * c;
          const y = oy + (p.y + 0.5) * c;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        if (pts.length === 1) ctx.lineTo(ox + (pts[0].x + 0.5) * c + 0.01, oy + (pts[0].y + 0.5) * c);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = c * 0.15;
        ctx.stroke();
        ctx.restore();
        layout = { ox, oy, c };
        return { x: ox + (pts[0].x + 0.5) * c, y: oy + (pts[0].y + 0.5) * c };
      },
      dispose() {},
    };
  },
};
