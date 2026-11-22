// Deep Space: vector graphics in the void. Edges wrap; asteroids drift one
// cell every few moves. They never drift into the snake or right in front of
// its head, so every crash is the player's own.
import { GridTopology } from '../topologies/grid.js';
import { fitBoard, lerpWrap, rng } from '../render/util.js';
import { absoluteGrid, gridUV } from './grid-input.js';

const W = 26;
const H = 16;
const ROCK_EVERY = 3; // snake moves per asteroid move
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export default {
  id: 'deepspace',
  title: 'Deep Space',
  blurb: 'Edges wrap. Asteroids drift. Space is big, but not that big.',
  controls: 'Arrow keys / WASD / swipe',
  tickMs: 115,
  deathTitle: 'Signal lost',
  deathMessage: 'Your snake became a very small asteroid belt.',
  hud: true,
  sfx: 'sawtooth',

  setup(stage) {
    let layout = null;
    const r = rng(Date.now());
    const topology = new GridTopology({ width: W, height: H, wrap: true });
    const key = (x, y) => y * W + x;
    const rocks = [];
    while (rocks.length < 9) {
      const x = Math.floor(r() * W);
      const y = Math.floor(r() * H);
      if (Math.abs(y - 8) <= 2 && x < 14) continue; // spawn lane
      if (rocks.some((k) => k.x === x && k.y === y)) continue;
      rocks.push({ x, y, px: x, py: y, d: Math.floor(r() * 4), spin: r() * 6, shape: Array.from({ length: 9 }, () => 0.7 + r() * 0.3) });
    }
    const sync = () => {
      topology.blocked = new Set(rocks.map((k) => key(k.x, k.y)));
      topology._cells = null; // free-cell cache (apples) must see the new rocks
    };
    sync();
    let moves = 0;
    let apple = null;
    const stars = Array.from({ length: 140 }, () => ({ x: r(), y: r(), z: 0.2 + r() * 0.8 }));

    const moveRocks = (snake) => {
      const avoid = new Set(snake.body.map((c) => key(c.x, c.y)));
      // keep the three cells ahead of the head clear
      let c = snake.head;
      for (let i = 0; i < 3; i++) {
        c = { x: (c.x + DX[snake.dir] + W) % W, y: (c.y + DY[snake.dir] + H) % H };
        avoid.add(key(c.x, c.y));
      }
      if (apple) avoid.add(key(apple.x, apple.y));
      for (const k of rocks) {
        k.px = k.x;
        k.py = k.y;
        for (const d of [k.d, (k.d + 1) % 4, (k.d + 3) % 4, (k.d + 2) % 4]) {
          const nx = (k.x + DX[d] + W) % W;
          const ny = (k.y + DY[d] + H) % H;
          const nk = key(nx, ny);
          if (avoid.has(nk) || rocks.some((o) => o !== k && o.x === nx && o.y === ny)) continue;
          k.x = nx;
          k.y = ny;
          k.d = d;
          break;
        }
      }
      sync();
    };

    return {
      topology,
      spawn: { cell: { x: 3, y: 8 }, dir: 1 },
      mapAction: absoluteGrid,
      uvOf: gridUV(W, H),
      screenOf: (cell) => layout && { x: layout.ox + (cell.x + 0.5) * layout.c, y: layout.oy + (cell.y + 0.5) * layout.c },
      afterStep(snake) {
        moves += 1;
        if (moves % ROCK_EVERY === 0) moveRocks(snake);
      },
      render(view) {
        const { ctx, width, height } = stage;
        apple = view.apple;
        const b = fitBoard(width - 32, height - 110, W, H);
        const c = b.cell;
        const ox = b.ox + 16;
        const oy = b.oy + 72;
        layout = { ox, oy, c };

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        for (const st of stars) {
          const x = ((st.x * width - view.time * 14 * st.z) % width + width) % width;
          ctx.fillStyle = `rgba(255,255,255,${st.z})`;
          ctx.fillRect(x, st.y * height, st.z * 2, st.z * 2);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + 0.5, oy + 0.5, b.w, b.h);

        ctx.save();
        ctx.lineJoin = 'round';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = 2;
        // asteroids glide between cells over one tick
        const t = moves % ROCK_EVERY === 0 ? view.alpha : 1;
        for (const k of rocks) {
          const x = ox + (lerpWrap(k.px, k.x, t, W) + 0.5) * c;
          const y = oy + (lerpWrap(k.py, k.y, t, H) + 0.5) * c;
          const a0 = k.spin + view.time * 0.8;
          ctx.beginPath();
          k.shape.forEach((rad, i) => {
            const a = a0 + (i / k.shape.length) * Math.PI * 2;
            const px = x + Math.cos(a) * rad * c * 0.48;
            const py = y + Math.sin(a) * rad * c * 0.48;
            if (i) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          });
          ctx.closePath();
          ctx.stroke();
        }

        if (view.apple) {
          const ax = ox + (view.apple.x + 0.5) * c;
          const ay = oy + (view.apple.y + 0.5) * c;
          ctx.strokeStyle = '#ffd60a';
          ctx.shadowColor = '#ffd60a';
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + view.time;
            const rad = (i % 2 ? 0.18 : 0.38) * c;
            const px = ax + Math.cos(a) * rad;
            const py = ay + Math.sin(a) * rad;
            if (i) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }

        const s = view.snake;
        ctx.strokeStyle = s.alive ? '#7df9ff' : '#ff4d6d';
        ctx.shadowColor = ctx.strokeStyle;
        let head = null;
        for (let i = s.body.length - 1; i >= 0; i--) {
          const a = s.prevOf(i);
          const q = s.body[i];
          const x = ox + (lerpWrap(a.x, q.x, view.alpha, W) % W + W) % W * c;
          const y = oy + (lerpWrap(a.y, q.y, view.alpha, H) % H + H) % H * c;
          const m = i === 0 ? 0.12 : 0.2;
          ctx.strokeRect(x + m * c, y + m * c, c * (1 - 2 * m), c * (1 - 2 * m));
          if (i === 0) {
            head = { x: x + c / 2, y: y + c / 2 };
            ctx.beginPath();
            ctx.moveTo(head.x, head.y);
            ctx.lineTo(head.x + DX[s.dir] * c * 0.45, head.y + DY[s.dir] * c * 0.45);
            ctx.stroke();
          }
        }
        ctx.restore();
        return head;
      },
      dispose() {},
    };
  },
};
