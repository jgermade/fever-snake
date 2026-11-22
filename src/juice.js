// Game feel: particle bursts, floating score text, screen shake and the
// sparkle around a golden apple. Drawn on the 2D overlay canvas on top of any
// world, 2D or 3D.

const particles = [];
const popups = [];
let shake = 0;

const RAINBOW = ['#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#ff77a8'];

export function burst(at, { count = 18, colors = ['#ffffff', '#00f0ff', '#ff2fb9'], speed = 220, size = 4 } = {}) {
  if (!at) return;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    particles.push({
      x: at.x,
      y: at.y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0.5 + Math.random() * 0.4,
      age: 0,
      size: size * (0.6 + Math.random() * 0.8),
      color: colors[i % colors.length],
    });
  }
}

export function rainbowBurst(at, count = 36) {
  burst(at, { count, colors: RAINBOW, speed: 320, size: 5 });
}

export function popup(at, text, color = '#fff') {
  if (at) popups.push({ x: at.x, y: at.y - 10, text, color, age: 0, life: 0.9 });
}

export function addShake(amount) {
  shake = Math.min(18, shake + amount);
}

/** Current shake offset in px; decays over time. */
export function shakeOffset(dt) {
  shake = Math.max(0, shake - dt * 40);
  if (!shake) return { x: 0, y: 0 };
  return { x: (Math.random() - 0.5) * shake, y: (Math.random() - 0.5) * shake };
}

export function drawJuice(ctx, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - dt * 2.5;
    p.vy = p.vy * (1 - dt * 2.5) + 300 * dt;
    ctx.globalAlpha = 1 - p.age / p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.age += dt;
    if (p.age >= p.life) {
      popups.splice(i, 1);
      continue;
    }
    const k = p.age / p.life;
    ctx.globalAlpha = 1 - k * k;
    ctx.font = `bold ${20 + k * 8}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(p.text, p.x, p.y - k * 50);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y - k * 50);
  }
  ctx.globalAlpha = 1;
}

/** Twinkling stars around a golden apple. */
export function drawGoldenSparkle(ctx, at, time) {
  if (!at) return;
  ctx.save();
  for (let i = 0; i < 6; i++) {
    const a = time * 2 + (i / 6) * Math.PI * 2;
    const r = 22 + Math.sin(time * 5 + i) * 5;
    const x = at.x + Math.cos(a) * r;
    const y = at.y + Math.sin(a) * r;
    const s = 3 + Math.sin(time * 9 + i * 2) * 2;
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 2);
    ctx.lineTo(x + s * 0.6, y - s * 0.6);
    ctx.lineTo(x + s * 2, y);
    ctx.lineTo(x + s * 0.6, y + s * 0.6);
    ctx.lineTo(x, y + s * 2);
    ctx.lineTo(x - s * 0.6, y + s * 0.6);
    ctx.lineTo(x - s * 2, y);
    ctx.lineTo(x - s * 0.6, y - s * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function clearJuice() {
  particles.length = 0;
  popups.length = 0;
  shake = 0;
}
