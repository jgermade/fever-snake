// World 6: green phosphor text-mode terminal with ASCII obstacles.
import { GridTopology, isFullyConnected } from '../topologies/grid.js';
import { pad, rng } from '../render/util.js';
import { absoluteGrid, gridUV } from './grid-input.js';

const W = 34;
const H = 18;
const GREEN = '#33ff66';
const DIM = '#127a33';
const BOOT = [
  'FEVER-DOS v6.22  (c) 1994 Fever Systems',
  'HIMEM is testing extended memory... done.',
  'C:\\> cd GAMES',
  'C:\\GAMES> SNAKE.COM /ascii',
];

function makeWalls(seed) {
  const r = rng(seed);
  for (let attempt = 0; attempt < 50; attempt++) {
    const walls = [];
    for (let i = 0; i < 9; i++) {
      const horiz = r() < 0.5;
      const len = 3 + Math.floor(r() * 4);
      const x0 = 2 + Math.floor(r() * (W - 4 - (horiz ? len : 0)));
      const y0 = 2 + Math.floor(r() * (H - 4 - (horiz ? 0 : len)));
      for (let k = 0; k < len; k++) {
        const x = x0 + (horiz ? k : 0);
        const y = y0 + (horiz ? 0 : k);
        // keep the spawn lane clear
        if (y === 9 && x < 14) continue;
        walls.push([x, y]);
      }
    }
    const topo = new GridTopology({ width: W, height: H, walls });
    if (isFullyConnected(topo, { x: 3, y: 9 })) return walls;
  }
  return [];
}

export default {
  id: 'terminal',
  title: 'Terminal',
  blurb: 'Text mode. Mind the # walls.',
  controls: 'Arrow keys / WASD / swipe',
  tickMs: 105,
  startDelay: 1.4,
  deathTitle: 'Segmentation fault',
  deathMessage: 'snake: core dumped (exit code 139)',
  hud: false,
  sfx: 'square',

  setup(stage) {
    const topology = new GridTopology({ width: W, height: H, walls: makeWalls(Date.now()) });
    return {
      topology,
      spawn: { cell: { x: 3, y: 9 }, dir: 1 },
      mapAction: absoluteGrid,
      uvOf: gridUV(W, H),
      render(view) {
        const { ctx, width, height } = stage;
        ctx.fillStyle = '#020b04';
        ctx.fillRect(0, 0, width, height);
        // character cell is 0.6 wide; board has a frame + 2 header lines
        const cols = W + 2;
        const rows = H + 4;
        const ch = Math.floor(Math.min((height - 24) / rows, (width - 24) / (cols * 0.62), 30));
        const cw = ch * 0.62;
        const ox = Math.floor((width - cols * cw) / 2);
        const oy = Math.floor((height - rows * ch) / 2);
        ctx.font = `bold ${ch}px "Courier New", ui-monospace, monospace`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.shadowColor = GREEN;
        ctx.shadowBlur = ch * 0.4;
        const put = (str, cx, cy, color = GREEN) => {
          ctx.fillStyle = color;
          for (let i = 0; i < str.length; i++) ctx.fillText(str[i], ox + (cx + i) * cw, oy + cy * ch);
        };

        // Boot sequence during the first second of the world
        const boot = view.worldTime;
        if (boot < 1.2) {
          const lines = Math.min(BOOT.length, Math.floor(boot / 0.25) + 1);
          for (let i = 0; i < lines; i++) put(BOOT[i], 0, i + 2);
          if (Math.floor(boot * 6) % 2) put('_', BOOT[lines - 1].length, lines + 1);
        } else {
          const bar = '#'.repeat(view.applesInWorld) + '.'.repeat(view.applesPerWorld - view.applesInWorld);
          put(`SCORE ${pad(view.score, 5)}  [${bar}]  WORLD ${view.worldIndex + 1}/${view.worldCount}  HI ${pad(view.best, 5)}`, 0, 0);
          put('+' + '-'.repeat(W) + '+', 0, 2, DIM);
          put('+' + '-'.repeat(W) + '+', 0, H + 3, DIM);
          for (let y = 0; y < H; y++) {
            put('|', 0, y + 3, DIM);
            put('|', W + 1, y + 3, DIM);
            for (let x = 0; x < W; x++) if (topology.isWall(x, y)) put('#', x + 1, y + 3);
          }
          if (view.apple && Math.floor(view.time * 4) % 4) put('*', view.apple.x + 1, view.apple.y + 3, '#ffe066');
          const s = view.snake;
          const headChar = ['^', '>', 'v', '<'][s.dir];
          for (let i = s.body.length - 1; i >= 0; i--) {
            const p = s.body[i];
            put(i === 0 ? (s.alive ? headChar : 'X') : 'o', p.x + 1, p.y + 3, i === 0 ? '#b6ffc8' : GREEN);
          }
        }
        ctx.shadowBlur = 0;

        // CRT scanlines + vignette + flicker
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        for (let y = 0; y < height; y += 3) ctx.fillRect(0, y, width, 1);
        const v = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.75);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(0,0,0,0.75)');
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = `rgba(51,255,102,${0.015 + Math.random() * 0.02})`;
        ctx.fillRect(0, 0, width, height);
        return { x: ox + (view.snake.head.x + 1.5) * cw, y: oy + (view.snake.head.y + 3.5) * ch };
      },
      dispose() {},
    };
  },
};
