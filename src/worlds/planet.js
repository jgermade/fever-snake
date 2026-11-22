// Tiny Planet: the cube topology inflated into a sphere ("cubed sphere"), so
// the snake circles a little world. Arrow keys are screen-relative.
import * as THREE from '../render/three.js';
import { CubeTopology, rotate90, vec } from '../topologies/cube.js';
import { damp } from '../render/util.js';
import { disposeScene, gridTexture, starField, toScreen } from '../render/three-util.js';

const N = 8;
const RADIUS = 6;
const FACE_COLORS = ['#5fbf4a', '#4aa3df', '#e0b85a', '#58c49a', '#7bc96f', '#3f8fd1'];

/** Position on the planet surface of a point given in cube coordinates. */
function spherePos(p, lift, out = new THREE.Vector3()) {
  return out.set(p[0], p[1], p[2]).normalize().multiplyScalar(RADIUS + lift);
}

export default {
  id: 'planet',
  title: 'Tiny Planet',
  blurb: 'A whole world, eight cells wide. Walk around it.',
  controls: 'Arrow keys are screen-relative',
  tickMs: 160,
  deathTitle: 'Game over',
  deathMessage: 'The planet is round. So, unfortunately, is your body.',
  hud: true,
  three: true,
  sfx: 'sine',

  setup(stage) {
    const topology = new CubeTopology(N);
    const control = { up: [0, 1, 0] };

    const gl = stage.getGL();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030614');
    scene.add(starField(1800, 140));
    const camera = new THREE.PerspectiveCamera(50, stage.width / stage.height, 0.1, 500);
    scene.add(camera);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const sun = new THREE.DirectionalLight(0xfff2d6, 2.4);
    sun.position.set(30, 20, 25);
    scene.add(sun);

    // Cube geometry with every vertex pushed onto the sphere: the per-face UV
    // grid then lines up with the snake's cells.
    const geo = new THREE.BoxGeometry(2, 2, 2, N * 3, N * 3, N * 3);
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      nrm.setXYZ(i, v.x, v.y, v.z);
      v.multiplyScalar(RADIUS);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    const mats = FACE_COLORS.map((col) => new THREE.MeshStandardMaterial({
      map: gridTexture({ cols: N, rows: N, size: 32, bg: col, line: 'rgba(255,255,255,0.35)', lineWidth: 2 }),
      roughness: 0.85,
    }));
    scene.add(new THREE.Mesh(geo, mats));
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 1.12, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x66bbff, transparent: true, opacity: 0.12, side: THREE.BackSide }),
    );
    scene.add(atmosphere);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshStandardMaterial({ color: 0xcfcfd8, roughness: 1 }));
    scene.add(moon);

    const body = new THREE.InstancedMesh(new THREE.SphereGeometry(0.38, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), 6 * N * N);
    scene.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 20, 16), new THREE.MeshStandardMaterial({ color: 0xff6b6b, emissive: 0x401010 }));
    scene.add(head);
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffd43b, emissive: 0x806000, emissiveIntensity: 0.6 }));
    scene.add(apple);

    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    const m4 = new THREE.Matrix4();
    const color = new THREE.Color();
    const eye = new THREE.Vector3(0, 0, 1);
    const upV = new THREE.Vector3(0, 1, 0);
    const focus = new THREE.Vector3();
    let camReady = false;

    const segPos = (s, i, lift, alpha, out) => {
      spherePos(s.prevOf(i).p, lift, tmpA);
      spherePos(s.body[i].p, lift, out);
      return out.lerp(tmpA, 1 - alpha).normalize().multiplyScalar(RADIUS + lift);
    };

    return {
      topology,
      spawn: { cell: { p: [-1, -1, N], n: [0, 0, 1] }, dir: [0, 1, 0] },
      control,
      mapAction(action, snake) {
        const up = control.up;
        const right = vec.cross(up, snake.head.n);
        return { up, down: vec.neg(up), right, left: vec.neg(right) }[action] ?? null;
      },
      afterStep(snake, from, to) {
        if (!vec.eq(from.n, to.n)) control.up = rotate90(control.up, vec.cross(from.n, to.n));
      },
      uvOf(cell) {
        const right = vec.cross(control.up, cell.n);
        return { u: (vec.dot(cell.p, right) / N + 1) / 2, v: (1 - vec.dot(cell.p, control.up) / N) / 2 };
      },
      placeCells: topology.cells().filter((c) => c.n[2] === 1),
      render(view) {
        const s = view.snake;
        body.count = Math.max(0, s.body.length - 1);
        for (let i = 1; i < s.body.length; i++) {
          segPos(s, i, 0.3, view.alpha, tmpB);
          const sc = 1 - Math.min(0.35, i * 0.006);
          m4.makeScale(sc, sc, sc).setPosition(tmpB);
          body.setMatrixAt(i - 1, m4);
          color.setHSL((0.02 + i * 0.01) % 1, 0.85, s.alive ? 0.62 : 0.3);
          body.setColorAt(i - 1, color);
        }
        body.instanceMatrix.needsUpdate = true;
        if (body.instanceColor) body.instanceColor.needsUpdate = true;
        segPos(s, 0, 0.38, view.alpha, head.position);
        head.material.color.set(s.alive ? 0xff6b6b : 0x660000);

        if (view.apple) {
          apple.visible = true;
          spherePos(view.apple.p, 0.4 + Math.sin(view.time * 4) * 0.08, apple.position);
        } else apple.visible = false;
        moon.position.set(Math.cos(view.time * 0.3) * 16, 4, Math.sin(view.time * 0.3) * 16);

        // Camera hovers above the head, tilted to show the path ahead.
        focus.copy(head.position).normalize().addScaledVector(tmpA.set(...control.up), -0.55).normalize();
        const k = camReady ? damp(4, view.dt) : 1;
        eye.lerp(focus, k).normalize();
        upV.lerp(tmpA.set(...control.up), k).normalize();
        camera.position.copy(eye).multiplyScalar(17);
        camera.up.copy(upV);
        camera.lookAt(0, 0, 0);
        camReady = true;

        camera.aspect = stage.width / stage.height;
        camera.fov = camera.aspect < 0.8 ? 72 : 50;
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
