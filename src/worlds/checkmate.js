// Checkmate: a giant chessboard; the pieces are obstacles.
import { GridTopology } from '../topologies/grid.js';
import { fitBoard, segPos } from '../render/util.js';
import { absoluteGrid, gridUV } from './grid-input.js';

const W = 16;
const H = 12;
const PIECES = [
  [3, 2, '♜'], [12, 2, '♞'], [7, 3, '♛'], [8, 3, '♚'], [5, 9, '♝'],
  [11, 9, '♜'], [14, 5, '♞'], [2, 9, '♟'], [9, 8, '♟'], [6, 6, '♟'], [13, 10, '♝'],
];

export default {
  id: 'checkmate',
  title: 'Checkmate',
  blurb: 'A giant chessboard. The pieces do not move, but they do not move aside either.',
  controls: 'Arrow keys / WASD / swipe',
  tickMs: 125,
  deathTitle: 'Checkmate',
  deathMessage: 'Your snake was captured.',
  hud: true,
  sfx: 'triangle',

  setup(stage) {
    let layout = null;
    const topology = new GridTopology({ width: W, height: H, walls: PIECES.map(([x, y]) => [x, y]) });
    return {
      topology,
      spawn: { cell: { x: 1, y: 5 }, dir: 1 },
      mapAction: absoluteGrid,
      uvOf: gridUV(W, H),
      screenOf: (cell) => layout && { x: layout.ox + (cell.x + 0.5) * layout.c, y: layout.oy + (cell.y + 0.5) * layout.c },
      render(view) {
        const { ctx, width, height } = stage;
        const b = fitBoard(width - 60, height - 130, W, H);
        const c = b.cell;
        const ox = b.ox + 30;
        const oy = b.oy + 80;
        layout = { ox, oy, c };

        const bg = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, Math.max(width, height));
        bg.addColorStop(0, '#3b2a1e');
        bg.addColorStop(1, '#140d08');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);
        // wooden frame
        ctx.fillStyle = '#6b4226';
        ctx.fillRect(ox - c * 0.6, oy - c * 0.6, b.w + c * 1.2, b.h + c * 1.2);
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(ox - c * 0.45, oy - c * 0.45, b.w + c * 0.9, b.h + c * 0.9);
        ctx.font = `${Math.floor(c * 0.32)}px Georgia, serif`;
        ctx.fillStyle = '#f3e3c3';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let x = 0; x < W; x++) ctx.fillText(String.fromCharCode(97 + x), ox + (x + 0.5) * c, oy + b.h + c * 0.24);
        for (let y = 0; y < H; y++) ctx.fillText(String(H - y), ox - c * 0.24, oy + (y + 0.5) * c);

        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            ctx.fillStyle = (x + y) % 2 ? '#b58863' : '#f0d9b5';
            ctx.fillRect(ox + x * c, oy + y * c, c, c);
          }
        }

        ctx.font = `${Math.floor(c * 0.85)}px "Segoe UI Symbol", "Noto Sans Symbols2", "DejaVu Sans", serif`;
        for (const [x, y, glyph] of PIECES) {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillText(glyph, ox + (x + 0.55) * c, oy + (y + 0.58) * c);
          ctx.fillStyle = '#1b1b1b';
          ctx.fillText(glyph, ox + (x + 0.5) * c, oy + (y + 0.52) * c);
        }

        if (view.apple) {
          const ax = ox + (view.apple.x + 0.5) * c;
          const ay = oy + (view.apple.y + 0.5) * c;
          ctx.fillStyle = '#c1121f';
          ctx.beginPath();
          ctx.arc(ax, ay + c * 0.05, c * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#2d6a4f';
          ctx.beginPath();
          ctx.ellipse(ax + c * 0.1, ay - c * 0.28, c * 0.12, c * 0.06, -0.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // The snake: a row of glossy ivory pawns-to-be
        const s = view.snake;
        let head = null;
        for (let i = s.body.length - 1; i >= 0; i--) {
          const p = segPos(s, i, view.alpha);
          const x = ox + (p.x + 0.5) * c;
          const y = oy + (p.y + 0.5) * c;
          const g = ctx.createRadialGradient(x - c * 0.12, y - c * 0.12, c * 0.05, x, y, c * 0.45);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(1, s.alive ? (i === 0 ? '#c9a227' : '#d9cbb0') : '#7a1c1c');
          ctx.fillStyle = g;
          ctx.strokeStyle = '#3a2a1a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, c * (i === 0 ? 0.44 : 0.38), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (i === 0) {
            head = { x, y };
            ctx.fillStyle = '#3a2a1a';
            ctx.font = `${Math.floor(c * 0.5)}px "Segoe UI Symbol", "DejaVu Sans", serif`;
            ctx.fillText('♔', x, y + c * 0.03);
          }
        }
        return head;
      },
      dispose() {},
    };
  },
};
