// Spreadsheet: the snake lives in the cells of an office spreadsheet.
import { GridTopology } from '../topologies/grid.js';
import { absoluteGrid, gridUV } from './grid-input.js';

const W = 16;
const H = 14;
const FONT = 'Calibri, Carlito, "Segoe UI", Arial, sans-serif';
const GREEN = '#1e7145';
const colName = (x) => String.fromCharCode(65 + x);

export default {
  id: 'spreadsheet',
  title: 'Spreadsheet',
  blurb: 'Q3 snake projections. Do not touch the margins.',
  controls: 'Arrow keys / WASD / swipe',
  tickMs: 125,
  deathTitle: '#REF!',
  deathMessage: 'Circular reference: the snake referenced itself (or the sheet edge).',
  hud: false,
  sfx: 'triangle',

  setup(stage) {
    let layout = null;
    const topology = new GridTopology({ width: W, height: H });
    return {
      topology,
      spawn: { cell: { x: 2, y: 7 }, dir: 1 },
      mapAction: absoluteGrid,
      uvOf: gridUV(W, H),
      screenOf: (cell) => layout && { x: layout.gx + (cell.x + 0.5) * layout.cw, y: layout.gy + (cell.y + 0.5) * layout.ch },
      render(view) {
        const { ctx, width, height } = stage;
        const s = view.snake;
        const text = (str, x, y, { size = 12, color = '#222', bold = false, align = 'left' } = {}) => {
          ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
          ctx.fillStyle = color;
          ctx.textAlign = align;
          ctx.textBaseline = 'middle';
          ctx.fillText(str, x, y);
        };

        ctx.fillStyle = '#f3f3f3';
        ctx.fillRect(0, 0, width, height);

        // Title bar and ribbon
        ctx.fillStyle = GREEN;
        ctx.fillRect(0, 0, width, 30);
        text('Snake_Q3_final_v2.xlsx  –  Sheets', width / 2, 15, { color: '#fff', align: 'center' });
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 30, width, 34);
        ['File', 'Home', 'Insert', 'Formulas', 'Data', 'Review'].forEach((t, i) => {
          text(t, 14 + i * 70, 47, { color: i === 1 ? GREEN : '#444', bold: i === 1 });
        });
        ctx.fillStyle = GREEN;
        ctx.fillRect(84, 60, 44, 3);

        // Formula bar
        const fy = 70;
        ctx.fillStyle = '#fff';
        ctx.fillRect(8, fy, 70, 24);
        ctx.fillRect(110, fy, width - 118, 24);
        ctx.strokeStyle = '#c8c8c8';
        ctx.strokeRect(8.5, fy + 0.5, 70, 24);
        ctx.strokeRect(110.5, fy + 0.5, width - 119, 24);
        text(`${colName(s.head.x)}${s.head.y + 1}`, 14, fy + 12);
        text('fx', 88, fy + 12, { color: '#777' });
        text(`=SNAKE(${s.body.length}, ${view.score})`, 118, fy + 12);

        // Grid geometry: cells are wider than tall
        const top = fy + 32;
        const bottom = 56;
        const headW = 34;
        const headH = 20;
        const ch = Math.floor(Math.min((height - top - bottom - headH) / H, (width - headW - 16) / (W * 2.4)));
        const cw = Math.floor(ch * 2.4);
        const gx = Math.floor((width - headW - cw * W) / 2) + headW;
        const gy = top + headH;
        layout = { gx, gy, cw, ch };

        ctx.fillStyle = '#fff';
        ctx.fillRect(gx, gy, cw * W, ch * H);
        // headers
        ctx.fillStyle = '#e6e6e6';
        ctx.fillRect(gx - headW, top, headW + cw * W, headH);
        ctx.fillRect(gx - headW, gy, headW, ch * H);
        for (let x = 0; x < W; x++) {
          const sel = x === s.head.x;
          if (sel) {
            ctx.fillStyle = '#d2e6da';
            ctx.fillRect(gx + x * cw, top, cw, headH);
          }
          text(colName(x), gx + (x + 0.5) * cw, top + headH / 2, { size: 11, color: sel ? GREEN : '#555', align: 'center', bold: sel });
        }
        for (let y = 0; y < H; y++) {
          const sel = y === s.head.y;
          if (sel) {
            ctx.fillStyle = '#d2e6da';
            ctx.fillRect(gx - headW, gy + y * ch, headW, ch);
          }
          text(String(y + 1), gx - headW / 2, gy + (y + 0.5) * ch, { size: 11, color: sel ? GREEN : '#555', align: 'center', bold: sel });
        }

        // Snake cells: green "good" style with values
        const fs = Math.max(9, Math.floor(ch * 0.55));
        for (let i = s.body.length - 1; i >= 0; i--) {
          const p = s.body[i];
          ctx.fillStyle = s.alive ? '#c6efce' : '#ffc7ce';
          ctx.fillRect(gx + p.x * cw, gy + p.y * ch, cw, ch);
          text(String(s.body.length - i), gx + (p.x + 1) * cw - 4, gy + (p.y + 0.5) * ch, { size: fs, color: s.alive ? '#006100' : '#9c0006', align: 'right' });
        }
        if (view.apple) {
          const ax = gx + view.apple.x * cw;
          const ay = gy + view.apple.y * ch;
          ctx.fillStyle = '#ffc7ce';
          ctx.fillRect(ax, ay, cw, ch);
          text('=APPLE()', ax + 4, ay + ch / 2, { size: fs, color: '#9c0006', bold: true });
          ctx.fillStyle = '#d00';
          ctx.beginPath();
          ctx.moveTo(ax + cw - 7, ay);
          ctx.lineTo(ax + cw, ay);
          ctx.lineTo(ax + cw, ay + 7);
          ctx.fill();
        }

        // gridlines
        ctx.strokeStyle = '#dadada';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= W; x++) {
          ctx.moveTo(gx + x * cw + 0.5, top);
          ctx.lineTo(gx + x * cw + 0.5, gy + H * ch);
        }
        for (let y = 0; y <= H; y++) {
          ctx.moveTo(gx - headW, gy + y * ch + 0.5);
          ctx.lineTo(gx + W * cw, gy + y * ch + 0.5);
        }
        ctx.stroke();

        // Selected cell (head) with fill handle
        const hx = gx + s.head.x * cw;
        const hy = gy + s.head.y * ch;
        ctx.strokeStyle = GREEN;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(hx, hy, cw, ch);
        ctx.fillStyle = GREEN;
        ctx.fillRect(hx + cw - 3, hy + ch - 3, 6, 6);

        // Sheet tabs and status bar
        const sy = height - bottom;
        ctx.fillStyle = '#f3f3f3';
        ctx.fillRect(0, sy, width, bottom);
        ['Snake', 'Apples', 'Q3'].forEach((t, i) => {
          ctx.fillStyle = i === 0 ? '#fff' : '#e6e6e6';
          ctx.fillRect(16 + i * 74, sy + 4, 70, 22);
          text(t, 51 + i * 74, sy + 15, { color: i === 0 ? GREEN : '#555', align: 'center', bold: i === 0 });
        });
        text('+', 16 + 3 * 74 + 10, sy + 15, { size: 16, color: '#555' });
        ctx.fillStyle = GREEN;
        ctx.fillRect(0, height - 24, width, 24);
        text(view.phase === 'playing' ? 'Ready' : 'Calculating...', 10, height - 12, { color: '#fff' });
        text(
          `Apples: ${view.applesInWorld}/${view.applesPerWorld}   Count: ${s.body.length}   Sum: ${view.score}   Stage: ${view.worldIndex + 1}/${view.worldCount}`,
          width - 10, height - 12, { color: '#fff', align: 'right' },
        );
        return { x: hx + cw / 2, y: hy + ch / 2 };
      },
      dispose() {},
    };
  },
};
