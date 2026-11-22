// World 4: a 4-shade green pocket LCD at a native 160x144 resolution.
// Edges wrap around.
import { GridTopology } from '../topologies/grid.js';
import { pad } from '../render/util.js';
import { absoluteGrid, gridUV } from './grid-input.js';

const W = 20;
const H = 16;
const PAL = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];

// 3x5 pixel font
const GLYPHS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001111', S: '111100111001111', C: '111100100100111',
  O: '111101101101111', R: '110101110101101', E: '111100110100111', W: '101101101111101',
  L: '100100100100111', D: '110101101101110', '/': '001001010100100', ' ': '000000000000000',
};

function drawText(g, str, x, y, color) {
  g.fillStyle = color;
  [...str].forEach((ch, i) => {
    const glyph = GLYPHS[ch] ?? GLYPHS[' '];
    for (let p = 0; p < 15; p++) {
      if (glyph[p] === '1') g.fillRect(x + i * 4 + (p % 3), y + Math.floor(p / 3), 1, 1);
    }
  });
}

const SPRITES = {
  body: ['.111111.', '11222211', '12233221', '12333321', '12333321', '12233221', '11222211', '.111111.'],
  head: ['.000000.', '00000000', '00300300', '00300300', '00000000', '00000000', '00000000', '.000000.'],
  apple: ['....0...', '...0....', '.000000.', '00030000', '00300000', '00000000', '00000000', '.00..00.'],
};

function sprite(g, rows, x, y) {
  rows.forEach((row, yy) => [...row].forEach((ch, xx) => {
    if (ch === '.') return;
    g.fillStyle = PAL[+ch];
    g.fillRect(x + xx, y + yy, 1, 1);
  }));
}

export default {
  id: 'pocket',
  title: 'Pocket LCD',
  blurb: 'Four shades of green. The edges wrap around.',
  controls: 'Arrow keys / WASD / swipe',
  tickMs: 125,
  deathTitle: 'GAME OVER',
  deathMessage: 'Insert coin. Just kidding, press A. Or Enter.',
  hud: false,
  sfx: 'square',

  setup(stage) {
    let layout = null;
    const topology = new GridTopology({ width: W, height: H, wrap: true });
    const lcd = document.createElement('canvas');
    lcd.width = 160;
    lcd.height = 144;
    const g = lcd.getContext('2d');

    return {
      topology,
      spawn: { cell: { x: 4, y: 8 }, dir: 1 },
      mapAction: absoluteGrid,
      uvOf: gridUV(W, H),
      /** Screen position of a cell, from the last rendered layout. */
      screenOf: (cell) => layout && ({ x: layout.sx + (cell.x * 8 + 4) * layout.scale, y: layout.sy + (16 + cell.y * 8 + 4) * layout.scale }),
      render(view) {
        // --- LCD contents at native resolution ---
        g.fillStyle = PAL[3];
        g.fillRect(0, 0, 160, 144);
        g.fillStyle = PAL[2];
        g.fillRect(0, 0, 160, 14);
        g.fillStyle = PAL[1];
        g.fillRect(0, 14, 160, 1);
        drawText(g, `SC ${pad(view.score, 4)}`, 4, 5, PAL[0]);
        drawText(g, `${view.applesInWorld}/${view.applesPerWorld}`, 70, 5, PAL[0]);
        drawText(g, `WORLD ${view.worldIndex + 1}`, 124, 5, PAL[0]);
        const top = 16;
        if (view.apple) {
          const bob = Math.floor(view.time * 3) % 2;
          sprite(g, SPRITES.apple, view.apple.x * 8, top + view.apple.y * 8 - bob);
        }
        const s = view.snake;
        for (let i = s.body.length - 1; i >= 0; i--) {
          const p = s.body[i];
          if (!s.alive && Math.floor(view.time * 8) % 2) continue; // death blink
          sprite(g, i === 0 ? SPRITES.head : SPRITES.body, p.x * 8, top + p.y * 8);
        }

        // --- Device ---
        const { ctx, width, height } = stage;
        ctx.fillStyle = '#2b2d42';
        ctx.fillRect(0, 0, width, height);
        const scale = Math.max(1, Math.floor(Math.min((width - 40) / 190, (height - 110) / 175)));
        const sw = 160 * scale;
        const sh = 144 * scale;
        const bw = sw + 30 * scale;
        const bh = sh + 34 * scale;
        const bx = Math.floor((width - bw) / 2);
        const by = Math.floor((height - bh) / 2) + 20;

        ctx.fillStyle = '#c4c0b8';
        roundRect(ctx, bx - 14, by - 14, bw + 28, bh + 70, 18);
        ctx.fillStyle = '#6b6f80';
        roundRect(ctx, bx, by, bw, bh, 10 * Math.min(scale, 2));
        // power LED
        ctx.fillStyle = Math.sin(view.time * 3) > -0.8 ? '#ff2a2a' : '#7a1010';
        ctx.beginPath();
        ctx.arc(bx + 7 * scale, by + bh / 2 - 10, Math.max(2, 2 * scale), 0, Math.PI * 2);
        ctx.fill();

        const sx = bx + 15 * scale;
        const sy = by + 12 * scale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(lcd, sx, sy, sw, sh);
        // dot-matrix gaps
        if (scale >= 3) {
          ctx.fillStyle = 'rgba(15,56,15,0.12)';
          for (let x = 0; x <= 160; x++) ctx.fillRect(sx + x * scale, sy, 1, sh);
          for (let y = 0; y <= 144; y++) ctx.fillRect(sx, sy + y * scale, sw, 1);
        }
        ctx.fillStyle = '#1d2b7a';
        ctx.font = `italic bold ${Math.max(12, 7 * scale)}px Verdana, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText('FEVER', bx, by + bh + 28);
        ctx.fillStyle = '#7a1d5c';
        ctx.fillText(' BOY', bx + ctx.measureText('FEVER').width, by + bh + 28);
        layout = { sx, sy, scale };
        return { x: sx + (view.snake.head.x * 8 + 4) * scale, y: sy + (16 + view.snake.head.y * 8 + 4) * scale };
      },
      dispose() {},
    };
  },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
