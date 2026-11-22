// Möbius Strip: a one-sided band with a half twist. Ride it once around and
// you come back on "the other side", mirrored. Controls are screen-relative.
import * as THREE from '../render/three.js';
import { MobiusTopology } from '../topologies/mobius.js';
import { damp, rng } from '../render/util.js';
import { disposeScene, gridTexture, starField, toScreen } from '../render/three-util.js';
import { gridUV } from './grid-input.js';

const W = 8; // across
const L = 64; // along
const R = L / (2 * Math.PI);
const SPAWN = { x: 3, y: 2 };

const uOf = (y) => (2 * Math.PI * (y + 0.5)) / L;
const vOf = (x) => x + 0.5 - W / 2;

function band(u, v, out = new THREE.Vector3()) {
  const k = R + v * Math.cos(u / 2);
  return out.set(k * Math.cos(u), k * Math.sin(u), v * Math.sin(u / 2));
}

/** Tangents along (u) and across (v), and the canonical normal. */
function frame(u, v) {
  const e = 1e-3;
  const tu = band(u + e, v).sub(band(u - e, v)).normalize();
  const tv = band(u, v + e).sub(band(u, v - e)).normalize();
  const n = new THREE.Vector3().crossVectors(tu, tv).normalize();
  return { tu, tv, n };
}

function makeWalls(seed) {
  const r = rng(seed);
  const walls = [];
  for (let y = 8; y < L - 2; y += 8) {
    const n = 2 + Math.floor(r() * 2);
    const x0 = Math.floor(r() * (W - n + 1));
    for (let k = 0; k < n; k++) walls.push([x0 + k, y]);
  }
  return walls;
}

export default {
  id: 'mobius',
  title: 'Möbius Strip',
  blurb: 'A band with one side. Go round once and you are upside down.',
  controls: 'Screen-relative; left/right flip after each lap',
  tickMs: 150,
  deathTitle: 'Game over',
  deathMessage: 'You fell off the edge of a surface that only has one side.',
  hud: true,
  three: true,
  sfx: 'sine',

  setup(stage) {
    const walls = makeWalls(Date.now());
    const topology = new MobiusTopology({ width: W, height: L, walls });
    const control = { along: 1, side: 1 };

    const gl = stage.getGL();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0716');
    scene.fog = new THREE.Fog(0x0a0716, 14, 40);
    scene.add(starField(1200, 120));
    const camera = new THREE.PerspectiveCamera(65, stage.width / stage.height, 0.05, 300);
    scene.add(camera);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(10, 20, 15);
    scene.add(key);
    camera.add(new THREE.PointLight(0xffffff, 20, 14, 1.5));

    // Band geometry
    const segU = L * 3;
    const segV = W * 2;
    const positions = [];
    const uvs = [];
    const index = [];
    for (let i = 0; i <= segU; i++) {
      const u = (i / segU) * Math.PI * 2;
      for (let j = 0; j <= segV; j++) {
        const v = (j / segV - 0.5) * W;
        const p = band(u, v);
        positions.push(p.x, p.y, p.z);
        uvs.push(i / segU, j / segV);
      }
    }
    for (let i = 0; i < segU; i++) {
      for (let j = 0; j < segV; j++) {
        const a = i * (segV + 1) + j;
        const b = a + segV + 1;
        index.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const tex = gridTexture({ size: 64, bg: '#f4a261', line: '#264653', lineWidth: 3 });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(L, W);
    scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.7 })));
    // The strip has a single edge, which goes round twice (u in [0, 4π)).
    const edge = [];
    for (let i = 0; i < 256; i++) edge.push(band((i / 256) * Math.PI * 4, W / 2));
    scene.add(new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true), 512, 0.12, 6, true),
      new THREE.MeshStandardMaterial({ color: 0xe76f51, emissive: 0x401000 }),
    ));

    const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.5 }), walls.length);
    const m4 = new THREE.Matrix4();
    walls.forEach(([x, y], i) => {
      const u = uOf(y);
      const v = vOf(x);
      const f = frame(u, v);
      m4.makeBasis(f.tu, f.tv, f.n).scale(new THREE.Vector3(0.95, 0.95, 1.1));
      m4.setPosition(band(u, v));
      wallMesh.setMatrixAt(i, m4);
    });
    scene.add(wallMesh);

    const body = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }), W * L);
    scene.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), new THREE.MeshStandardMaterial({ color: 0x8338ec, emissive: 0x2a0a50 }));
    scene.add(head);
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 14), new THREE.MeshStandardMaterial({ color: 0xff006e, emissive: 0x600020 }));
    scene.add(apple);

    const cellPos = (c, out) => band(uOf(c.y), vOf(c.x), out);
    const tmp = new THREE.Vector3();
    const color = new THREE.Color();
    const camPos = new THREE.Vector3();
    const camUp = new THREE.Vector3();
    const look = new THREE.Vector3();
    let camReady = false;

    /** Camera frame at the head: forward, up (side-corrected), right. */
    const headFrame = (cell) => {
      const f = frame(uOf(cell.y), vOf(cell.x));
      const fwd = f.tu.clone().multiplyScalar(control.along);
      const up = f.n.clone().multiplyScalar(control.side);
      const right = new THREE.Vector3().crossVectors(fwd, up);
      return { f, fwd, up, right };
    };

    return {
      topology,
      spawn: { cell: { ...SPAWN }, dir: 2 },
      control,
      uvOf: gridUV(W, L),
      mapAction(action, snake) {
        const along = control.along > 0;
        if (action === 'up') return along ? 2 : 0;
        if (action === 'down') return along ? 0 : 2;
        // left/right: whichever across direction points right on screen
        const { f, right } = headFrame(snake.head);
        const plusX = right.dot(f.tv) > 0;
        if (action === 'right') return plusX ? 1 : 3;
        if (action === 'left') return plusX ? 3 : 1;
        return null;
      },
      afterStep(snake, from, to, fromDir, dir) {
        if (Math.abs(to.y - from.y) > 1) control.side = -control.side;
        if (dir === 2) control.along = 1;
        if (dir === 0) control.along = -1;
      },
      render(view) {
        const s = view.snake;
        body.count = Math.max(0, s.body.length - 1);
        for (let i = 1; i < s.body.length; i++) {
          cellPos(s.prevOf(i), tmp);
          const p = cellPos(s.body[i], new THREE.Vector3()).lerp(tmp, 1 - view.alpha);
          const sc = 1 - Math.min(0.35, i * 0.006);
          m4.makeScale(sc, sc, sc).setPosition(p);
          body.setMatrixAt(i - 1, m4);
          color.setHSL((0.75 + i * 0.012) % 1, 0.8, s.alive ? 0.62 : 0.3);
          body.setColorAt(i - 1, color);
        }
        body.instanceMatrix.needsUpdate = true;
        if (body.instanceColor) body.instanceColor.needsUpdate = true;
        cellPos(s.prevOf(0), tmp);
        cellPos(s.head, head.position).lerp(tmp, 1 - view.alpha);
        head.material.color.set(s.alive ? 0x8338ec : 0x550000);

        if (view.apple) {
          apple.visible = true;
          cellPos(view.apple, apple.position);
          apple.scale.setScalar(1 + Math.sin(view.time * 5) * 0.08);
        } else apple.visible = false;

        // Chase camera above the head on the snake's current side of the band.
        const { fwd, up } = headFrame(s.head);
        const k = camReady ? damp(5, view.dt) : 1;
        tmp.copy(head.position).addScaledVector(up, 5).addScaledVector(fwd, -7);
        camPos.lerp(tmp, k);
        camUp.lerp(up, k).normalize();
        tmp.copy(head.position).addScaledVector(fwd, 5);
        look.lerp(tmp, k);
        if (!camReady) {
          camPos.copy(head.position).addScaledVector(up, 5).addScaledVector(fwd, -7);
          camUp.copy(up);
          look.copy(tmp);
        }
        camReady = true;
        camera.position.copy(camPos);
        camera.up.copy(camUp);
        camera.lookAt(look);
        camera.aspect = stage.width / stage.height;
        camera.fov = camera.aspect < 0.8 ? 85 : 65;
        camera.updateProjectionMatrix();
        gl.render(scene, camera);
        return toScreen(head.position, camera, stage);
      },
      dispose() {
        disposeScene(scene);
      },
    };
  },
};
