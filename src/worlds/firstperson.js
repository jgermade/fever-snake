// World 7: first-person labyrinth. You are the head of the snake.
// Left/right turn relative to where you look. A minimap helps.
import * as THREE from '../render/three.js';
import { GridTopology, isFullyConnected } from '../topologies/grid.js';
import { damp, lerp, rng } from '../render/util.js';
import { disposeScene } from '../render/three-util.js';
import { relativeGrid } from './grid-input.js';

const S = 17;
const SPAWN = { x: 1, y: S - 2 };

function makeWalls(seed) {
  const rand = rng(seed);
  for (let attempt = 0; attempt < 80; attempt++) {
    const walls = [];
    for (let i = 0; i < S; i++) walls.push([i, 0], [i, S - 1], [0, i], [S - 1, i]);
    // pillars on a lattice, extended into short random walls
    for (let y = 3; y < S - 2; y += 3) {
      for (let x = 3; x < S - 2; x += 3) {
        walls.push([x, y]);
        if (rand() < 0.55) {
          const d = Math.floor(rand() * 4);
          const dx = [0, 1, 0, -1][d];
          const dy = [-1, 0, 1, 0][d];
          walls.push([x + dx, y + dy]);
        }
      }
    }
    const filtered = walls.filter(([x, y]) => !(y === SPAWN.y && x < 7));
    const topo = new GridTopology({ width: S, height: S, walls: filtered });
    if (isFullyConnected(topo, SPAWN)) return filtered;
  }
  throw new Error('Could not build a connected labyrinth');
}

function brickTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#5b2a1c';
  g.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 8; row++) {
    for (let col = -1; col < 5; col++) {
      const x = col * 32 + (row % 2) * 16;
      const shade = 110 + Math.floor(Math.random() * 50);
      g.fillStyle = `rgb(${shade + 40},${shade - 50},${shade - 70})`;
      g.fillRect(x + 1, row * 16 + 1, 30, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2d2d38';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#3a3a4a';
  g.fillRect(0, 0, 32, 32);
  g.fillRect(32, 32, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(S / 2, S / 2);
  t.magFilter = THREE.NearestFilter;
  return t;
}

const yawOf = (dir) => (-dir * Math.PI) / 2;

export default {
  id: 'firstperson',
  title: 'Labyrinth',
  blurb: 'First person. You are the head. Do not bite yourself.',
  controls: 'Left / right to turn',
  tickMs: 230,
  deathTitle: 'Game over',
  deathMessage: 'Something bit you in the dark. It was you.',
  hud: true,
  sfx: 'triangle',

  setup(stage) {
    const walls = makeWalls(Date.now());
    const topology = new GridTopology({ width: S, height: S, walls });

    const gl = stage.getGL();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b0b1a');
    scene.fog = new THREE.Fog(0x0b0b1a, 2, 13);
    const camera = new THREE.PerspectiveCamera(70, stage.width / stage.height, 0.05, 60);
    camera.rotation.order = 'YXZ';
    scene.add(camera);
    scene.add(new THREE.HemisphereLight(0xb0c4ff, 0x302020, 0.9));
    const torch = new THREE.PointLight(0xffc47a, 12, 9, 1.5);
    camera.add(torch);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(S / 2 - 0.5, 0, S / 2 - 0.5);
    scene.add(floor);

    const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.2, 1), new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.85 }), walls.length);
    const m4 = new THREE.Matrix4();
    walls.forEach(([x, y], i) => {
      m4.makeTranslation(x, 0.6, y);
      wallMesh.setMatrixAt(i, m4);
    });
    scene.add(wallMesh);

    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.5, 0.62), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), S * S);
    scene.add(body);
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xaa0000, emissiveIntensity: 0.8 }));
    scene.add(apple);
    const appleLight = new THREE.PointLight(0xff3030, 6, 5, 2);
    scene.add(appleLight);

    const color = new THREE.Color();
    let yaw = null;

    return {
      topology,
      spawn: { cell: { ...SPAWN }, dir: 1 },
      mapAction: relativeGrid,
      render(view) {
        const s = view.snake;
        const a = view.alpha;
        body.count = Math.max(0, s.body.length - 1);
        for (let i = 1; i < s.body.length; i++) {
          const p = s.prevOf(i);
          const q = s.body[i];
          m4.makeTranslation(lerp(p.x, q.x, a), 0.25, lerp(p.y, q.y, a));
          body.setMatrixAt(i - 1, m4);
          color.setHSL(0.33, 0.8, s.alive ? 0.35 + 0.2 * Math.sin(i * 0.9) : 0.25);
          body.setColorAt(i - 1, color);
        }
        body.instanceMatrix.needsUpdate = true;
        if (body.instanceColor) body.instanceColor.needsUpdate = true;

        if (view.apple) {
          apple.visible = true;
          apple.position.set(view.apple.x, 0.45 + Math.sin(view.time * 3) * 0.08, view.apple.y);
          appleLight.position.copy(apple.position);
        } else apple.visible = false;

        const p = s.prevOf(0);
        const q = s.head;
        // Pull the camera slightly back so the turn reads well.
        const target = yawOf(s.dir);
        if (yaw == null) yaw = target;
        let d = target - yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        yaw += d * damp(12, view.dt);
        const hx = lerp(p.x, q.x, a) + Math.sin(yaw) * 0.35;
        const hz = lerp(p.y, q.y, a) + Math.cos(yaw) * 0.35;
        camera.position.set(hx, 0.55 + Math.sin(view.time * 9) * 0.015, hz);
        camera.rotation.set(s.alive ? -0.05 : -0.6, yaw, 0);
        camera.aspect = stage.width / stage.height;
        camera.fov = camera.aspect < 0.8 ? 90 : 70;
        camera.updateProjectionMatrix();
        gl.render(scene, camera);

        // Minimap on the 2D overlay canvas
        const ctx = stage.ctx;
        const cell = Math.max(4, Math.floor(Math.min(stage.width, stage.height) / 4 / S));
        const mx = stage.width - cell * S - 16;
        const my = stage.height - cell * S - 16;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(mx - 4, my - 4, cell * S + 8, cell * S + 8);
        ctx.fillStyle = '#7a3a26';
        for (const [x, y] of walls) ctx.fillRect(mx + x * cell, my + y * cell, cell, cell);
        ctx.fillStyle = '#3ddc84';
        for (const c of s.body) ctx.fillRect(mx + c.x * cell + 1, my + c.y * cell + 1, cell - 2, cell - 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(mx + q.x * cell, my + q.y * cell, cell, cell);
        if (view.apple && Math.floor(view.time * 4) % 2) {
          ctx.fillStyle = '#ff3030';
          ctx.fillRect(mx + view.apple.x * cell, my + view.apple.y * cell, cell, cell);
        }
      },
      dispose() {
        disposeScene(scene);
      },
    };
  },
};
