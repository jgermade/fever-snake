// World 2: a 1995-style desktop. The game runs inside a beveled window.
import { GridTopology } from '../topologies/grid.js';
import { fitBoard, pad } from '../render/util.js';
import { absoluteGrid } from './grid-input.js';

const W = 22;
const H = 14;
const FONT = 'Tahoma, "MS Sans Serif", Verdana, Arial, sans-serif';

const C = {
  face: '#c0c0c0',
  light: '#ffffff',
  shadow: '#808080',
  dark: '#000000',
  desk: '#008080',
  title1: '#000080',
  title2: '#1084d0',
};

// 8x8 pixel apple
const APPLE = [
  '...gg...',
  '....g...',
  '.rrrrrr.',
  'rrwrrrrr',
  'rwrrrrrr',
  'rrrrrrrr',
  '.rrrrrr.',
  '..rr.rr.',
];

function bevel(ctx, x, y, w, h, raised = true) {
  ctx.fillStyle = C.face;
  ctx.fillRect(x, y, w, h);
  const [tl, br, tl2, br2] = raised
    ? [C.light, C.dark, '#dfdfdf', C.shadow]
    : [C.shadow, C.light, C.dark, '#dfdfdf'];
  ctx.fillStyle = tl;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = br;
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = tl2;
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, h - 2);
  ctx.fillStyle = br2;
  ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
}

function text(ctx, str, x, y, { size = 11, color = '#000', bold = false, align = 'left' } = {}) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function desktopIcon(ctx, x, y, label, kind) {
  if (kind === 'pc') {
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(x + 6, y, 24, 18);
    ctx.fillStyle = '#000080';
    ctx.fillRect(x + 9, y + 3, 18, 12);
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(x + 2, y + 21, 32, 7);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 2, y + 27, 32, 1);
  } else {
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(x + 9, y + 4, 18, 22);
    ctx.fillStyle = '#808080';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 12 + i * 4, y + 7, 1, 17);
    ctx.fillStyle = '#404040';
    ctx.fillRect(x + 7, y + 2, 22, 3);
  }
  text(ctx, label, x + 18, y + 38, { color: '#fff', align: 'center' });
}

export default {
  id: 'retro95',
  title: 'Retro 95',
  blurb: 'SNAKE.EXE has booted. Please do not press the Start button.',
  controls: 'Arrow keys / WASD / swipe',
  tickMs: 120,
  deathTitle: 'SNAKE.EXE',
  deathMessage: 'This program has performed an illegal operation and will be shut down.',
  hud: false,
  sfx: 'square',

  setup(stage) {
    const topology = new GridTopology({ width: W, height: H });
    return {
      topology,
      spawn: { cell: { x: 3, y: H >> 1 }, dir: 1 },
      mapAction: absoluteGrid,
      render(view) {
        const { ctx, width, height } = stage;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = C.desk;
        ctx.fillRect(0, 0, width, height);

        // Desktop icons (only when there is room)
        if (width > 700) {
          desktopIcon(ctx, 16, 16, 'My Computer', 'pc');
          desktopIcon(ctx, 16, 84, 'Recycle Bin', 'bin');
        }

        // Taskbar
        const tbH = 28;
        bevel(ctx, 0, height - tbH, width, tbH, true);
        bevel(ctx, 2, height - tbH + 3, 64, tbH - 6, true);
        // start-button icon: a tiny green snake
        ctx.fillStyle = '#008000';
        ctx.fillRect(9, height - 16, 10, 3);
        ctx.fillRect(16, height - 21, 3, 6);
        ctx.fillRect(16, height - 21, 6, 3);
        text(ctx, 'Start', 27, height - tbH / 2, { bold: true });
        bevel(ctx, 72, height - tbH + 3, Math.min(160, width - 160), tbH - 6, false);
        text(ctx, 'SNAKE.EXE', 80, height - tbH / 2);
        const now = new Date();
        bevel(ctx, width - 72, height - tbH + 3, 68, tbH - 6, false);
        text(ctx, `${pad(now.getHours(), 2)}:${pad(now.getMinutes(), 2)}`, width - 38, height - tbH / 2, { align: 'center' });

        // Window
        const chromeTop = 4 + 18 + 20 + 4;
        const chromeBottom = 4 + 22 + 4;
        const b = fitBoard(width - 40, height - tbH - 40 - chromeTop - chromeBottom, W, H, { integer: true, max: 36 });
        const c = b.cell;
        const winW = b.w + 16;
        const winH = b.h + chromeTop + chromeBottom + 4;
        const wx = Math.floor((width - winW) / 2);
        const wy = Math.floor((height - tbH - winH) / 2);
        bevel(ctx, wx, wy, winW, winH, true);
        const tg = ctx.createLinearGradient(wx, 0, wx + winW, 0);
        tg.addColorStop(0, C.title1);
        tg.addColorStop(1, C.title2);
        ctx.fillStyle = tg;
        ctx.fillRect(wx + 3, wy + 3, winW - 6, 18);
        text(ctx, 'SNAKE.EXE - Fever Snake', wx + 8, wy + 12, { color: '#fff', bold: true });
        for (let i = 0; i < 3; i++) {
          const bx = wx + winW - 21 - i * 18 - (i > 0 ? 2 : 0);
          bevel(ctx, bx, wy + 5, 16, 14, true);
          ctx.fillStyle = '#000';
          if (i === 0) {
            ctx.font = `bold 11px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.fillText('x', bx + 8, wy + 12);
          } else if (i === 1) {
            ctx.strokeStyle = '#000';
            ctx.strokeRect(bx + 3.5, wy + 7.5, 8, 7);
            ctx.fillRect(bx + 3, wy + 7, 9, 2);
          } else {
            ctx.fillRect(bx + 4, wy + 14, 6, 2);
          }
        }
        const menuY = wy + 22;
        ['Game', 'Options', 'Help'].forEach((m, i) => {
          text(ctx, m, wx + 10 + i * 56, menuY + 10);
          ctx.fillRect(wx + 10 + i * 56, menuY + 16, 6, 1);
        });

        // Board (sunken)
        const bx = wx + 8;
        const by = wy + chromeTop;
        bevel(ctx, bx - 2, by - 2, b.w + 4, b.h + 4, false);
        ctx.fillStyle = '#fff';
        ctx.fillRect(bx, by, b.w, b.h);
        ctx.fillStyle = '#e8e8e8';
        for (let y = 0; y < H; y++)
          for (let x = (y & 1); x < W; x += 2) ctx.fillRect(bx + x * c, by + y * c, c, c);

        if (view.apple) {
          const px = Math.max(1, Math.floor(c / 8));
          const ax = bx + view.apple.x * c + Math.floor((c - px * 8) / 2);
          const ay = by + view.apple.y * c + Math.floor((c - px * 8) / 2);
          APPLE.forEach((row, yy) =>
            [...row].forEach((ch, xx) => {
              if (ch === '.') return;
              ctx.fillStyle = ch === 'r' ? '#ff0000' : ch === 'g' ? '#008000' : '#fff';
              ctx.fillRect(ax + xx * px, ay + yy * px, px, px);
            }),
          );
        }

        const s = view.snake;
        for (let i = s.body.length - 1; i >= 0; i--) {
          const p = s.body[i];
          const x = bx + p.x * c;
          const y = by + p.y * c;
          bevel(ctx, x, y, c, c, true);
          ctx.fillStyle = !s.alive ? '#800000' : i === 0 ? '#000080' : '#1084d0';
          ctx.fillRect(x + 2, y + 2, c - 4, c - 4);
          if (i === 0) {
            ctx.fillStyle = '#fff';
            const e = Math.max(2, Math.floor(c / 6));
            ctx.fillRect(x + c * 0.25, y + c * 0.3, e, e);
            ctx.fillRect(x + c * 0.62, y + c * 0.3, e, e);
          }
        }

        // Status bar
        const sy = by + b.h + 6;
        const cols = [0.4, 0.3, 0.3];
        let sx = wx + 6;
        const total = winW - 12;
        const labels = [
          `Score: ${view.score}`,
          `Apples: ${view.applesInWorld}/${view.applesPerWorld}`,
          `World ${view.worldIndex + 1} of ${view.worldCount}`,
        ];
        cols.forEach((f, i) => {
          const w = Math.floor(total * f) - 2;
          bevel(ctx, sx, sy, w, 20, false);
          text(ctx, labels[i], sx + 6, sy + 10);
          sx += w + 2;
        });
      },
      dispose() {},
    };
  },
};
