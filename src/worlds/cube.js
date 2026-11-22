// World 3: the snake crawls over the six faces of a cube floating in space.
// Arrow keys are screen-relative; the camera rolls over the edges with you.
import * as THREE from '../render/three.js';
import { CubeTopology, rotate90, vec } from '../topologies/cube.js';
import { damp } from '../render/util.js';
import { disposeScene, gridTexture, starField, toScreen } from '../render/three-util.js';

const N = 8;
const MAX_SEGMENTS = 6 * N * N;
const FACE_COLORS = ['#ff3d7f', '#ff9f1c', '#2ec4b6', '#3a86ff', '#8338ec', '#ffbe0b'];

/** World position of a cell: centre on the face, raised by `lift`. */
function cellPos(cell, lift, out = new THREE.Vector3()) {
  return out.set(cell.p[0] / 2 + cell.n[0] * lift, cell.p[1] / 2 + cell.n[1] * lift, cell.p[2] / 2 + cell.n[2] * lift);
}

export default {
  id: 'cube',
  title: 'The Cube',
  blurb: 'Six faces, no walls. Fall over the edge and keep going.',
  controls: 'Arrow keys are screen-relative',
  tickMs: 165,
  deathTitle: 'Game over',
  deathMessage: "Lost in the cube's geometry.",
  hud: true,
  sfx: 'sine',

  setup(stage) {
    const topology = new CubeTopology(N);
    const control = { up: [0, 1, 0] };

    const gl = stage.getGL();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05030f');
    scene.add(starField());
    const camera = new THREE.PerspectiveCamera(50, stage.width / stage.height, 0.1, 500);
    camera.position.set(0, 0, 18);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    camera.add(sun);
    sun.position.set(4, 6, 2);
    scene.add(camera);

    const mats = FACE_COLORS.map((col) =>
      new THREE.MeshStandardMaterial({
        map: gridTexture({ cols: N, rows: N, size: 32, bg: col, line: 'rgba(255,255,255,0.55)', lineWidth: 2 }),
        roughness: 0.6,
      }),
    );
    const cube = new THREE.Mesh(new THREE.BoxGeometry(N, N, N), mats);
    scene.add(cube);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: 0xffffff }));
    scene.add(edges);

    const segGeo = new THREE.BoxGeometry(0.82, 0.82, 0.82);
    const body = new THREE.InstancedMesh(segGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }), MAX_SEGMENTS);
    body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), new THREE.MeshStandardMaterial({ color: 0x1b1b1b, emissive: 0x00ff88, emissiveIntensity: 0.35 }));
    scene.add(head);

    const apple = new THREE.Group();
    const appleBall = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 16), new THREE.MeshStandardMaterial({ color: 0xff1e1e, emissive: 0x550000, roughness: 0.3 }));
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x22aa22 }));
    leaf.position.y = 0.42;
    apple.add(appleBall, leaf);
    scene.add(apple);

    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    const m4 = new THREE.Matrix4();
    const color = new THREE.Color();
    const camQ = new THREE.Quaternion();
    const upV = new THREE.Vector3();
    const eye = new THREE.Vector3(0, 0, 1);
    const focus = new THREE.Vector3();
    let camReady = false;

    return {
      topology,
      spawn: { cell: { p: [-1, -1, N], n: [0, 0, 1] }, dir: [0, 1, 0] },
      control,
      mapAction(action, snake) {
        const n = snake.head.n;
        const up = control.up;
        const right = vec.cross(up, n);
        return { up, down: vec.neg(up), right, left: vec.neg(right) }[action] ?? null;
      },
      // Screen-like coordinates of a cell on the face the camera looks at.
      uvOf(cell) {
        const right = vec.cross(control.up, cell.n);
        return { u: (vec.dot(cell.p, right) / N + 1) / 2, v: (1 - vec.dot(cell.p, control.up) / N) / 2 };
      },
      // A snake arriving from another world lands on the face in view.
      placeCells: topology.cells().filter((c) => c.n[2] === 1),
      afterStep(snake, from, to) {
        if (!vec.eq(from.n, to.n)) control.up = rotate90(control.up, vec.cross(from.n, to.n));
      },
      render(view) {
        const s = view.snake;
        const count = s.body.length;
        body.count = Math.max(0, count - 1);
        for (let i = 1; i < count; i++) {
          cellPos(s.prevOf(i), 0.42, tmpA);
          cellPos(s.body[i], 0.42, tmpB);
          tmpA.lerp(tmpB, view.alpha);
          const sc = 1 - Math.min(0.35, i * 0.006);
          m4.makeScale(sc, sc, sc).setPosition(tmpA);
          body.setMatrixAt(i - 1, m4);
          color.setHSL((0.38 + i * 0.012) % 1, 0.9, s.alive ? 0.55 : 0.3);
          body.setColorAt(i - 1, color);
        }
        body.instanceMatrix.needsUpdate = true;
        if (body.instanceColor) body.instanceColor.needsUpdate = true;
        cellPos(s.prevOf(0), 0.48, tmpA);
        cellPos(s.head, 0.48, tmpB);
        head.position.copy(tmpA.lerp(tmpB, view.alpha));
        head.material.emissive.set(s.alive ? 0x00ff88 : 0xff0033);

        if (view.apple) {
          apple.visible = true;
          cellPos(view.apple, 0.45 + Math.sin(view.time * 4) * 0.08, apple.position);
          apple.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmpA.set(...view.apple.n));
          apple.rotateY(view.time * 2);
        } else apple.visible = false;

        // Camera: look at the head's face, biased toward the head.
        const n = s.head.n;
        const up = control.up;
        const right = vec.cross(up, n);
        focus.set(n[0], n[1], n[2])
          .addScaledVector(tmpA.set(...up), 0.45)
          .addScaledVector(tmpB.set(...right), 0.3)
          .addScaledVector(head.position, 0.05)
          .normalize();
        const k = camReady ? damp(5, view.dt) : 1;
        eye.lerp(focus, k).normalize();
        upV.lerp(tmpA.set(...up), k).normalize();
        m4.lookAt(tmpB.copy(eye).multiplyScalar(17), tmpA.set(0, 0, 0), upV);
        camQ.setFromRotationMatrix(m4);
        camera.quaternion.copy(camQ);
        camera.position.copy(eye).multiplyScalar(17);
        camReady = true;

        camera.aspect = stage.width / stage.height;
        camera.fov = camera.aspect < 0.8 ? 70 : 50;
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
