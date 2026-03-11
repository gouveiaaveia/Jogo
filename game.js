import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

const canvas = document.querySelector('#game');
const hud = document.querySelector('#hud');
const scoreEl = document.querySelector('#score');
const statusEl = document.querySelector('#status');
const startMenu = document.querySelector('#start-menu');
const gameOverMenu = document.querySelector('#gameover-menu');
const finalScoreEl = document.querySelector('#final-score');
const startBtn = document.querySelector('#start-btn');
const restartBtn = document.querySelector('#restart-btn');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd7ff);
scene.fog = new THREE.Fog(0x8fd7ff, 40, 130);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 280);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x4c6a50, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(22, 34, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const LANE_SIZE = 4;
const HALF_WIDTH = 20;
const AHEAD = 35;
const BEHIND = 10;
const MOVE_TIME = 0.12;

const lanes = new Map();
let highestLane = -1;
let maxScore = 0;
let playing = false;
let alive = true;
let shake = 0;

const laneGeo = new THREE.BoxGeometry(HALF_WIDTH * 2, 1, LANE_SIZE);
const bridgeGeo = new THREE.BoxGeometry(3.2, 0.45, LANE_SIZE * 0.95);

function color(type) {
  return { grass: 0x75c85f, road: 0x2a2f39, water: 0x3f95dd }[type];
}

function createVehicle(z, direction) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1.25, 1.9),
    new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.7, 0.52) })
  );
  mesh.position.set(-HALF_WIDTH + Math.random() * HALF_WIDTH * 2, 0.65, z);
  mesh.castShadow = true;
  scene.add(mesh);
  return { mesh, speed: (2.8 + Math.random() * 2) * direction, halfX: 1.4 };
}

function createLog(z, direction) {
  const length = 3.2 + Math.random() * 2.8;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.8, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x8f6138, roughness: 0.9 })
  );
  mesh.position.set(-HALF_WIDTH + Math.random() * HALF_WIDTH * 2, 0.45, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return { mesh, speed: (1.3 + Math.random() * 1.2) * direction, halfX: length / 2 };
}

function createLane(index) {
  const rnd = Math.random();
  const type = index < 2 ? 'grass' : rnd < 0.44 ? 'road' : rnd < 0.72 ? 'grass' : 'water';
  const laneMesh = new THREE.Mesh(laneGeo, new THREE.MeshStandardMaterial({ color: color(type) }));
  laneMesh.position.set(0, -0.5, index * LANE_SIZE);
  laneMesh.receiveShadow = true;
  scene.add(laneMesh);

  const lane = { type, index, mesh: laneMesh, movers: [], bridges: [] };

  if (type === 'road') {
    const dir = Math.random() > 0.5 ? 1 : -1;
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i += 1) lane.movers.push(createVehicle(index * LANE_SIZE, dir));
  }

  if (type === 'water') {
    const dir = Math.random() > 0.5 ? 1 : -1;
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i += 1) lane.movers.push(createLog(index * LANE_SIZE, dir));

    // Ponte: garante caminho seguro na água.
    if (Math.random() < 0.75) {
      const slots = [-12, -8, -4, 0, 4, 8, 12];
      const center = slots[Math.floor(Math.random() * slots.length)];
      for (let x = center - 2; x <= center + 2; x += 4) {
        const bridge = new THREE.Mesh(
          bridgeGeo,
          new THREE.MeshStandardMaterial({ color: 0xd8c38a, roughness: 0.8, metalness: 0.08 })
        );
        bridge.position.set(x, 0.22, index * LANE_SIZE);
        bridge.castShadow = true;
        bridge.receiveShadow = true;
        scene.add(bridge);
        lane.bridges.push({ mesh: bridge, halfX: 1.6 });
      }
    }
  }

  lanes.set(index, lane);
  highestLane = Math.max(highestLane, index);
}

function ensureWorld(playerLane) {
  while (highestLane < playerLane + AHEAD) createLane(highestLane + 1);
  const minKeep = Math.max(0, playerLane - BEHIND);
  for (const [idx, lane] of lanes.entries()) {
    if (idx < minKeep) {
      scene.remove(lane.mesh);
      for (const m of lane.movers) scene.remove(m.mesh);
      for (const b of lane.bridges) scene.remove(b.mesh);
      lanes.delete(idx);
    }
  }
}
for (let i = 0; i <= AHEAD; i += 1) createLane(i);

const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 1.2), new THREE.MeshStandardMaterial({ color: 0xfff8d4 }));
body.position.y = 1.25;
body.castShadow = true;
player.add(body);
const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.95, 1), new THREE.MeshStandardMaterial({ color: 0xfce6a2 }));
head.position.y = 2.1;
head.castShadow = true;
player.add(head);
const beak = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.42), new THREE.MeshStandardMaterial({ color: 0xff9d2f }));
beak.position.set(0, 2.05, 0.7);
player.add(beak);
scene.add(player);

const trail = new THREE.Points(
  new THREE.BufferGeometry().setFromPoints(Array.from({ length: 24 }, () => new THREE.Vector3(0, -100, 0))),
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.35 })
);
scene.add(trail);

camera.position.set(0, 17, -15);
camera.lookAt(0, 0, 8);

let targetX = 0;
let targetLane = 0;
let moving = false;
let moveT = 0;
const from = new THREE.Vector3();
const to = new THREE.Vector3();

function laneNow() {
  return Math.round(player.position.z / LANE_SIZE);
}

function startMove(dx, dz) {
  if (!playing || !alive || moving) return;
  const nextX = targetX + dx * LANE_SIZE;
  const nextLane = targetLane + dz;
  if (Math.abs(nextX) > HALF_WIDTH - 2 || nextLane < 0 || nextLane > highestLane) return;
  targetX = nextX;
  targetLane = nextLane;
  moving = true;
  moveT = 0;
  from.copy(player.position);
  to.set(targetX, 0, targetLane * LANE_SIZE);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') startMove(0, 1);
  if (e.code === 'ArrowDown' || e.code === 'KeyS') startMove(0, -1);
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') startMove(-1, 0);
  if (e.code === 'ArrowRight' || e.code === 'KeyD') startMove(1, 0);
});

function die(message) {
  alive = false;
  playing = false;
  shake = 0.35;
  statusEl.textContent = message;
  finalScoreEl.textContent = String(maxScore);
  gameOverMenu.classList.remove('hidden');
}

function updateTrails() {
  const positions = trail.geometry.attributes.position.array;
  for (let i = positions.length - 3; i >= 3; i -= 3) {
    positions[i] = positions[i - 3];
    positions[i + 1] = positions[i - 2];
    positions[i + 2] = positions[i - 1];
  }
  positions[0] = player.position.x;
  positions[1] = 0.35;
  positions[2] = player.position.z - 0.2;
  trail.geometry.attributes.position.needsUpdate = true;
}

function updateMovement(dt) {
  if (!moving) return;
  moveT += dt / MOVE_TIME;
  const t = Math.min(moveT, 1);
  player.position.lerpVectors(from, to, t);
  player.position.y = Math.sin(Math.PI * t) * 0.95;
  player.scale.y = 1 - Math.sin(Math.PI * t) * 0.08;
  if (t >= 1) {
    moving = false;
    player.position.y = 0;
    player.scale.y = 1;
    if (targetLane > maxScore) {
      maxScore = targetLane;
      scoreEl.textContent = String(maxScore);
      statusEl.textContent = 'A avançar!';
    }
  }
}

function wrap(x) {
  if (x > HALF_WIDTH + 9) return -HALF_WIDTH - 9;
  if (x < -HALF_WIDTH - 9) return HALF_WIDTH + 9;
  return x;
}

function onBridge(lane) {
  return lane.bridges.some((b) => Math.abs(b.mesh.position.x - player.position.x) < b.halfX + 0.3);
}

function detectHazards(dt) {
  const lane = lanes.get(laneNow());
  if (!lane) return;

  if (lane.type === 'road') {
    for (const car of lane.movers) {
      if (Math.abs(car.mesh.position.x - player.position.x) < car.halfX + 0.52 && Math.abs(car.mesh.position.z - player.position.z) < 1.2) {
        die('Foste atropelado!');
        return;
      }
    }
  }

  if (lane.type === 'water') {
    if (onBridge(lane)) return;

    let onLog = false;
    for (const log of lane.movers) {
      if (Math.abs(log.mesh.position.x - player.position.x) < log.halfX - 0.1 && Math.abs(log.mesh.position.z - player.position.z) < 1.25) {
        onLog = true;
        if (!moving) {
          player.position.x += log.speed * dt;
          targetX = player.position.x;
        }
      }
    }

    if (!onLog && !moving) die('Caíste na água!');
    if (Math.abs(player.position.x) > HALF_WIDTH - 1.2) die('A corrente levou-te!');
  }
}

function updateWorld(dt) {
  const laneIndex = laneNow();
  ensureWorld(laneIndex);

  for (const lane of lanes.values()) {
    for (const mover of lane.movers) {
      mover.mesh.position.x = wrap(mover.mesh.position.x + mover.speed * dt);
    }
    if (lane.type === 'water') {
      lane.mesh.material.color.offsetHSL(0, 0, Math.sin(performance.now() * 0.002 + lane.index) * 0.00025);
    }
  }
}

function updateCamera(dt) {
  const baseX = player.position.x;
  const baseZ = player.position.z - 15;
  const amp = shake > 0 ? shake * 0.4 : 0;
  camera.position.x += (baseX + (Math.random() - 0.5) * amp - camera.position.x) * 0.09;
  camera.position.z += (baseZ + (Math.random() - 0.5) * amp - camera.position.z) * 0.09;
  camera.lookAt(player.position.x, 0, player.position.z + 8);
  shake = Math.max(0, shake - dt * 1.7);
}

function resetGame() {
  alive = true;
  playing = true;
  maxScore = 0;
  targetX = 0;
  targetLane = 0;
  moving = false;
  moveT = 0;
  player.position.set(0, 0, 0);
  scoreEl.textContent = '0';
  statusEl.textContent = 'Boa sorte!';

  // Limpa e regenera mundo do início
  for (const lane of lanes.values()) {
    scene.remove(lane.mesh);
    for (const m of lane.movers) scene.remove(m.mesh);
    for (const b of lane.bridges) scene.remove(b.mesh);
  }
  lanes.clear();
  highestLane = -1;
  for (let i = 0; i <= AHEAD; i += 1) createLane(i);
}

startBtn.addEventListener('click', () => {
  startMenu.classList.add('hidden');
  hud.classList.remove('hidden');
  resetGame();
});

restartBtn.addEventListener('click', () => {
  gameOverMenu.classList.add('hidden');
  resetGame();
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.03);

  if (playing && alive) {
    updateMovement(dt);
    updateWorld(dt);
    detectHazards(dt);
    updateTrails();
  }

  updateCamera(dt);
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
