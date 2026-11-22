// Mirror Twins: you steer two snakes at once — the second is your reflection
// across the centre line. If either twin crashes, both do. Either twin can eat.
import { GridTopology } from '../topologies/grid.js';
import { fitBoard, segPos } from '../render/util.js';
import { absoluteGrid, gridUV } from './grid-input.js';

const W = 24; // even: the mirror line runs between two columns
const H = 15;
const OBSTACLES = [[4, 3], [5, 3], [8, 10], [8, 11], [3, 12], [10, 5], [6, 7]];
const mx = (x) => W - 1 - x;

export default {
  id: 'mirror',
  title: 'Mirror Twins',
  blurb: 'You steer two snakes: you and your reflection. Both must survive.',
  controls: 'Arrow keys / WASD / swipe · the twin mirrors you',
  tickMs: 130,
  deathTitle: 'Seven years of bad luck',
  deathMessage: 'One of the twins broke the mirror.',
  hud: true,
  sfx: 'square',

  setup(stage) {
    let layout = null;
    // The board is symmetric for the topology (so either twin hitting an
    // obstacle is a crash); visually the reflected obstacles are ghosts.
    const walls = [...OBSTACLES, ...OBSTACLES.map(([x, y]) => [mx(x), y])];
    const topology = new GridTopology({ width: W, height: H, walls });
    const key = (x, y) => y * W + x;
    return {
      topology,
      spawn: { cell: { x: 2, y: 13 }, dir: 0 },
      mapAction: absoluteGrid,
      uvOf: gridUV(W, H),
      screenOf: (cell) => layout && { x: layout.ox + (cell.x + 0.5) * layout.c, y: layout.oy + (cell.y + 0.5) * layout.c },
      // either twin eats the apple
      appleCells: (apple) => [apple, { x: mx(apple.x), y: apple.y }],
      // the twins must not touch each other
      collides: (cell, snake) => {
        const twin = key(mx(cell.x), cell.y);
        return snake.body.some((b, i) => key(b.x, b.y) === twin && !(i === snake.body.length - 1 && snake.grow === 0));
      },
      render(view) {
        const { ctx, width, height } = stage;
        const b = fitBoard(width - 32, height - 110, W, H);
        const c = b.cell;
        const ox = b.ox + 16;
        const oy = b.oy + 72;
        layout = { ox, oy, c };

        const bg = ctx.createLinearGradient(0, 0, width, 0);
        bg.addColorStop(0, '#0d1b3a');
        bg.addColorStop(0.5, '#1d0f2e');
        bg.addColorStop(1, '#3a0d2a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(ox, oy, b.w, b.h);
        // mirror line
        const midX = ox + (W / 2) * c;
        const shimmer = ctx.createLinearGradient(0, oy, 0, oy + b.h);
        for (let i = 0; i <= 6; i++) shimmer.addColorStop(i / 6, `rgba(220,240,255,${0.35 + 0.35 * Math.sin(view.time * 3 + i)})`);
        ctx.fillStyle = shimmer;
        ctx.fillRect(midX - 2, oy - 6, 4, b.h + 12);

        for (const [x, y] of OBSTACLES) {
          ctx.fillStyle = '#6c7a96';
          ctx.fillRect(ox + x * c + 2, oy + y * c + 2, c - 4, c - 4);
          ctx.strokeStyle = 'rgba(200,170,220,0.55)';
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(ox + mx(x) * c + 3, oy + y * c + 3, c - 6, c - 6);
          ctx.setLineDash([]);
        }

        if (view.apple) {
          for (const [ax, alpha] of [[view.apple.x, 1], [mx(view.apple.x), 0.55]]) {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.arc(ox + (ax + 0.5) * c, oy + (view.apple.y + 0.5) * c, c * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        const s = view.snake;
        const pts = s.body.map((_, i) => segPos(s, i, view.alpha));
        const drawSnake = (flip, color, headColor) => {
          ctx.strokeStyle = s.alive ? color : '#ff4d6d';
          ctx.lineWidth = c * 0.62;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          pts.forEach((p, i) => {
            const x = ox + ((flip ? mx(p.x) : p.x) + 0.5) * c;
            const y = oy + (p.y + 0.5) * c;
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          });
          if (pts.length === 1) ctx.lineTo(ox + ((flip ? mx(pts[0].x) : pts[0].x) + 0.5) * c + 0.01, oy + (pts[0].y + 0.5) * c);
          ctx.stroke();
          ctx.fillStyle = headColor;
          ctx.beginPath();
          ctx.arc(ox + ((flip ? mx(pts[0].x) : pts[0].x) + 0.5) * c, oy + (pts[0].y + 0.5) * c, c * 0.18, 0, Math.PI * 2);
          ctx.fill();
        };
        drawSnake(false, '#4cc9f0', '#ffffff');
        drawSnake(true, '#f72585', '#ffffff');
        return { x: ox + (pts[0].x + 0.5) * c, y: oy + (pts[0].y + 0.5) * c };
      },
      dispose() {},
    };
  },
};
