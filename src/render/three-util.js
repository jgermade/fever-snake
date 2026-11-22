import * as THREE from './three.js';

/** Canvas texture with a single grid cell (to be repeated) or an n x m grid. */
export function gridTexture({ cols = 1, rows = 1, size = 64, bg = '#111', line = '#0ff', lineWidth = 2, glow = 0 }) {
  const canvas = document.createElement('canvas');
  canvas.width = size * cols;
  canvas.height = size * rows;
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = line;
  g.lineWidth = lineWidth;
  if (glow) {
    g.shadowColor = line;
    g.shadowBlur = glow;
  }
  for (let x = 0; x <= cols; x++) {
    g.beginPath();
    g.moveTo(x * size, 0);
    g.lineTo(x * size, canvas.height);
    g.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    g.beginPath();
    g.moveTo(0, y * size);
    g.lineTo(canvas.width, y * size);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Frees GPU resources of everything in a scene. */
export function disposeScene(scene) {
  scene.traverse((obj) => {
    obj.geometry?.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose();
    }
  });
}

/** A random star field, as Points on a large sphere. */
export function starField(count = 1500, radius = 120) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([s * Math.cos(t) * radius, u * radius, s * Math.sin(t) * radius], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, sizeAttenuation: true }));
}
