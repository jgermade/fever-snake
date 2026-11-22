// World 5: a maze inside a tube. The tube is a torus, so it never ends; ring
// walls with gaps block the way. Left/right crawls around the tube wall.
import * as THREE from '../render/three.js';
import { GridTopology } from '../topologies/grid.js';
import { damp, lerpWrap, rng } from '../render/util.js';
import { disposeScene, gridTexture } from '../render/three-util.js';

const A = 16; // cells around the tube (x)
const L = 72; // cells along the tube (y)
const RING_EVERY = 9;
const R = L / (2 * Math.PI);
const r = A / (2 * Math.PI);
const SPAWN = { x: 0, y: 6 };

function makeWalls(seed) {
  const rand = rng(seed);
  const walls = [];
  for (let y = 4; y < L; y += RING_EVERY) {
    const gap = 3 + Math.floor(rand() * 3);
    // the first ring ahead of the spawn has its gap on the spawn lane
    const start = y === 4 + RING_EVERY ? SPAWN.x - 1 : Math.floor(rand() * A);
    for (let x = 0; x < A; x++) {
      const d = (x - start + A) % A;
      if (d >= gap) walls.push([x, y]);
    }
    // a couple of loose blocks between rings
    for (let k = 0; k < 2; k++) {
      const by = y + 3 + Math.floor(rand() * 4);
      const bx = Math.floor(rand() * A);
      if (bx === SPAWN.x || (by - SPAWN.y + L) % L < 4) continue;
      walls.push([bx, by % L]);
    }
  }
  return walls;
}

const phiOf = (y) => (2 * Math.PI * (y + 0.5)) / L;
const thetaOf = (x) => (2 * Math.PI * (x + 0.5)) / A;

function torusPoint(phi, theta, rho, out = new THREE.Vector3()) {
  const k = R + rho * Math.cos(theta);
  return out.set(k * Math.cos(phi), k * Math.sin(phi), rho * Math.sin(theta));
}

function frame(phi, theta) {
  const tPhi = new THREE.Vector3(-Math.sin(phi), Math.cos(phi), 0);
  const tTheta = new THREE.Vector3(-Math.sin(theta) * Math.cos(phi), -Math.sin(theta) * Math.sin(phi), Math.cos(theta));
  const radial = new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.cos(theta) * Math.sin(phi), Math.sin(theta));
  return { tPhi, tTheta, radial };
}

export default {
  id: 'tube',
  title: 'Tube Maze',
  blurb: 'An endless tube with ring walls. Find the gaps.',
  controls: 'Up/down along the tube, left/right around it',
  tickMs: 150,
  deathTitle: 'Game over',
  deathMessage: 'Splat against a ring wall.',
  hud: true,
  sfx: 'sawtooth',

  setup(stage) {
    const walls = makeWalls(Date.now());
    const topology = new GridTopology({ width: A, height: L, wrap: true, walls });
    const control = { along: 1 }; // +1 when the camera looks toward +y

    const gl = stage.getGL();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020008');
    scene.fog = new THREE.Fog(0x020008, 4, 26);
    const camera = new THREE.PerspectiveCamera(75, stage.width / stage.height, 0.05, 100);
    scene.add(camera);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const lamp = new THREE.PointLight(0xffffff, 40, 18, 1.6);
    camera.add(lamp);

    const tex = gridTexture({ size: 64, bg: '#14062b', line: '#00e5ff', lineWidth: 3, glow: 8 });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(L, A);
    const tube = new THREE.Mesh(
      new THREE.TorusGeometry(R, r, A * 4, L * 3),
      new THREE.MeshStandardMaterial({ map: tex, side: THREE.BackSide, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.8 }),
    );
    scene.add(tube);

    const wallMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xff2bd6, emissive: 0x8a0070, emissiveIntensity: 0.6, roughness: 0.4 }),
      walls.length,
    );
    const m4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    walls.forEach(([x, y], i) => {
      const phi = phiOf(y);
      const theta = thetaOf(x);
      const f = frame(phi, theta);
      const len = ((R + r * Math.cos(theta)) * 2 * Math.PI) / L;
      const wid = (r * 2 * Math.PI) / A;
      m4.makeBasis(f.tPhi, f.tTheta, f.radial.clone().negate()).scale(new THREE.Vector3(len * 0.96, wid * 0.96, 0.75));
      m4.setPosition(torusPoint(phi, theta, r - 0.45, pos));
      wallMesh.setMatrixAt(i, m4);
    });
    scene.add(wallMesh);

    const MAX = A * L;
    const body = new THREE.InstancedMesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }), MAX);
    scene.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.47, 20, 16), new THREE.MeshStandardMaterial({ color: 0xc6ff00, emissive: 0x335500 }));
    scene.add(head);
    const apple = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 1), new THREE.MeshStandardMaterial({ color: 0xffe600, emissive: 0xff8800, emissiveIntensity: 0.8, flatShading: true }));
    scene.add(apple);
    const appleLight = new THREE.PointLight(0xffaa00, 8, 6, 2);
    scene.add(appleLight);

    const color = new THREE.Color();
    const lookAt = new THREE.Vector3();
    const cam = { theta: null, yaw: 0 };

    const segAngles = (s, i, alpha) => {
      const a = s.prevOf(i);
      const b = s.body[i];
      return [phiOf(lerpWrap(a.y, b.y, alpha, L)), thetaOf(lerpWrap(a.x, b.x, alpha, A))];
    };

    return {
      topology,
      spawn: { cell: { ...SPAWN }, dir: 2 },
      control,
      mapAction(action) {
        const f = control.along > 0;
        return { up: f ? 2 : 0, down: f ? 0 : 2, right: f ? 1 : 3, left: f ? 3 : 1 }[action] ?? null;
      },
      afterStep(snake, from, to, fromDir, dir) {
        if (dir === 2) control.along = 1;
        if (dir === 0) control.along = -1;
      },
      render(view) {
        const s = view.snake;
        body.count = Math.max(0, s.body.length - 1);
        for (let i = 1; i < s.body.length; i++) {
          const [phi, theta] = segAngles(s, i, view.alpha);
          const sc = 1 - Math.min(0.4, i * 0.008);
          m4.makeScale(sc, sc, sc).setPosition(torusPoint(phi, theta, r - 0.42, pos));
          body.setMatrixAt(i - 1, m4);
          color.setHSL((0.22 + i * 0.015) % 1, 1, s.alive ? 0.55 : 0.25);
          body.setColorAt(i - 1, color);
        }
        body.instanceMatrix.needsUpdate = true;
        if (body.instanceColor) body.instanceColor.needsUpdate = true;

        const [hPhi, hTheta] = segAngles(s, 0, view.alpha);
        torusPoint(hPhi, hTheta, r - 0.48, head.position);
        head.material.color.set(s.alive ? 0xc6ff00 : 0xff2244);

        if (view.apple) {
          apple.visible = true;
          torusPoint(phiOf(view.apple.y), thetaOf(view.apple.x), r - 0.5 - Math.sin(view.time * 5) * 0.08, apple.position);
          apple.rotation.set(view.time, view.time * 1.3, 0);
          appleLight.position.copy(apple.position);
        } else apple.visible = false;

        // Camera rides behind the head, rolling so the head's wall is "floor".
        const k = cam.theta == null ? 1 : damp(7, view.dt);
        if (cam.theta == null) cam.theta = hTheta;
        let dTheta = hTheta - cam.theta;
        dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
        cam.theta += dTheta * k;
        const yawTarget = control.along > 0 ? 0 : Math.PI;
        cam.yaw += (yawTarget - cam.yaw) * damp(4, view.dt);
        const f = frame(hPhi, cam.theta);
        const fwd = f.tPhi.clone().multiplyScalar(Math.cos(cam.yaw)).addScaledVector(f.tTheta, Math.sin(cam.yaw));
        torusPoint(hPhi, cam.theta, r - 1.75, camera.position).addScaledVector(fwd, -3.4);
        torusPoint(hPhi, cam.theta, r - 0.7, lookAt).addScaledVector(fwd, 4);
        camera.up.copy(f.radial).negate();
        camera.lookAt(lookAt);

        camera.aspect = stage.width / stage.height;
        camera.fov = camera.aspect < 0.8 ? 95 : 75;
        camera.updateProjectionMatrix();
        gl.render(scene, camera);
      },
      dispose() {
        disposeScene(scene);
      },
    };
  },
};
