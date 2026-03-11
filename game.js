import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

const canvas = document.querySelector('#game');
const scoreEl = document.querySelector('#score');
const statusEl = document.querySelector('#status');
const restartBtn = document.querySelector('#restart');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 35, 110);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 250);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const hemi = new THREE.HemisphereLight(0xffffff, 0x4f6d57, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(20, 34, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -42;
sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
scene.add(sun);

const LANE_SIZE = 4;
const HALF_WIDTH = 18;
const MOVE_TIME = 0.14;
const AHEAD_BUFFER = 34;
const BEHIND_BUFFER = 8;

const laneColors = {
  grass: 0x78c964,
  road: 0x2a3038,
  water: 0x3d95d8,
};

const lanes = new Map();
let highestLaneGenerated = -1;
let maxLaneReached = 0;
let alive = true;

const groundGeo = new THREE.BoxGeometry(HALF_WIDTH * 2, 1, LANE_SIZE);
const roadLineGeo = new THREE.BoxGeometry(HALF_WIDTH * 1.8, 0.03, 0.16);

function makeVehicle(index, direction, speedBase) {
  const car = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1.25, 1.9),
    new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.68, 0.5) })
  );
  car.castShadow = true;
  car.position.set(-HALF_WIDTH + Math.random() * HALF_WIDTH * 2, 0.65, index * LANE_SIZE);
  scene.add(car);

  return {
    mesh: car,
    speed: (speedBase + Math.random() * 1.8) * direction,
    halfX: 1.3,
  };
}

function makeLog(index, direction, speedBase) {
  const length = 3.5 + Math.random() * 2.8;
  const log = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.8, 2.4),
    new THREE.MeshStandardMaterial({ color: 0x8f5e34, roughness: 0.92 })
  );
  log.castShadow = true;
  log.receiveShadow = true;
  log.position.set(-HALF_WIDTH + Math.random() * HALF_WIDTH * 2, 0.35, index * LANE_SIZE);
  scene.add(log);

  return {
    mesh: log,
    speed: (speedBase + Math.random() * 1.1) * direction,
    halfX: length * 0.5,
  };
}

function createLane(index) {
  const roll = Math.random();
  const type = index < 2 ? 'grass' : roll < 0.46 ? 'road' : roll < 0.76 ? 'grass' : 'water';

  const laneMesh = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ color: laneColors[type] })
  );
  laneMesh.position.set(0, -0.5, index * LANE_SIZE);
  laneMesh.receiveShadow = true;
  scene.add(laneMesh);

  const lane = {
    index,
    type,
    mesh: laneMesh,
    movers: [],
    direction: 1,
  };

  if (type === 'road') {
    const lines = new THREE.Mesh(roadLineGeo, new THREE.MeshStandardMaterial({ color: 0xf7f2c0 }));
    lines.position.set(0, 0.02, index * LANE_SIZE);
    scene.add(lines);
    lane.roadLine = lines;

    const count = 2 + Math.floor(Math.random() * 3);
    const direction = Math.random() < 0.5 ? -1 : 1;
    lane.direction = direction;

    for (let i = 0; i < count; i += 1) lane.movers.push(makeVehicle(index, direction, 2.6));
  }

  if (type === 'water') {
    const count = 2 + Math.floor(Math.random() * 2);
    const direction = Math.random() < 0.5 ? -1 : 1;
    lane.direction = direction;

    for (let i = 0; i < count; i += 1) lane.movers.push(makeLog(index, direction, 1.5));
  }

  lanes.set(index, lane);
  highestLaneGenerated = Math.max(highestLaneGenerated, index);
}

function ensureLanesAround(playerLane) {
  const targetMax = playerLane + AHEAD_BUFFER;
  while (highestLaneGenerated < targetMax) createLane(highestLaneGenerated + 1);

  const minKeep = Math.max(0, playerLane - BEHIND_BUFFER);
  for (const [index, lane] of lanes.entries()) {
    if (index < minKeep) {
      scene.remove(lane.mesh);
      if (lane.roadLine) scene.remove(lane.roadLine);
      for (const mover of lane.movers) scene.remove(mover.mesh);
      lanes.delete(index);
    }
  }
}

for (let i = 0; i <= AHEAD_BUFFER; i += 1) createLane(i);

const player = new THREE.Group();

const body = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 1.3, 1.2),
  new THREE.MeshStandardMaterial({ color: 0xfff9d9 })
);
body.castShadow = true;
body.position.y = 1.35;
player.add(body);

const head = new THREE.Mesh(
  new THREE.BoxGeometry(1.15, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xfde7a5 })
);
head.castShadow = true;
head.position.y = 2.2;
player.add(head);

const beak = new THREE.Mesh(
  new THREE.BoxGeometry(0.4, 0.24, 0.42),
  new THREE.MeshStandardMaterial({ color: 0xff9d2c })
);
beak.position.set(0, 2.1, 0.7);
player.add(beak);

player.position.set(0, 0, 0);
scene.add(player);

camera.position.set(0, 17, -15);
camera.lookAt(0, 0, 8);

let targetX = 0;
let targetLane = 0;
let moving = false;
let moveProgress = 0;
const startPos = new THREE.Vector3();
const endPos = new THREE.Vector3();

function laneLimit() {
  return highestLaneGenerated;
}

function startMove(dx, dz) {
  if (!alive || moving) return;

  const nextX = targetX + dx * LANE_SIZE;
  const nextLane = targetLane + dz;

  if (Math.abs(nextX) > HALF_WIDTH - 2 || nextLane < 0 || nextLane > laneLimit()) return;

  targetX = nextX;
  targetLane = nextLane;
  moving = true;
  moveProgress = 0;
  startPos.copy(player.position);
  endPos.set(targetX, 0, targetLane * LANE_SIZE);
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'ArrowUp' || event.code === 'KeyW') startMove(0, 1);
  if (event.code === 'ArrowDown' || event.code === 'KeyS') startMove(0, -1);

  // Correção pedida: D para direita e A para esquerda, respeitando a perspetiva atual.
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') startMove(1, 0);
  if (event.code === 'ArrowRight' || event.code === 'KeyD') startMove(-1, 0);
});

function resetGame() {
  alive = true;
  statusEl.textContent = 'Pronto para jogar';
  restartBtn.hidden = true;
  player.position.set(0, 0, 0);
  targetX = 0;
  targetLane = 0;
  moving = false;
  moveProgress = 0;
  maxLaneReached = 0;
  scoreEl.textContent = '0';
}

restartBtn.addEventListener('click', resetGame);

const clock = new THREE.Clock();

function wrapMover(mover) {
  if (mover.mesh.position.x > HALF_WIDTH + 8) mover.mesh.position.x = -HALF_WIDTH - 8;
  if (mover.mesh.position.x < -HALF_WIDTH - 8) mover.mesh.position.x = HALF_WIDTH + 8;
}

function currentLaneIndex() {
  return Math.round(player.position.z / LANE_SIZE);
}

function detectCollisionAndWater(dt) {
  const lane = lanes.get(currentLaneIndex());
  if (!lane || !alive) return;

  if (lane.type === 'road') {
    for (const car of lane.movers) {
      if (Math.abs(car.mesh.position.x - player.position.x) < car.halfX + 0.55 && Math.abs(car.mesh.position.z - player.position.z) < 1.3) {
        alive = false;
        statusEl.textContent = 'Fim de jogo! Foste atropelado.';
        restartBtn.hidden = false;
        return;
      }
    }
  }

  if (lane.type === 'water') {
    let onLog = false;
    for (const log of lane.movers) {
      const withinX = Math.abs(log.mesh.position.x - player.position.x) < log.halfX - 0.15;
      if (withinX && Math.abs(log.mesh.position.z - player.position.z) < 1.4) {
        onLog = true;
        if (!moving) {
          player.position.x += log.speed * dt;
          targetX = player.position.x;
        }
        break;
      }
    }

    if (!onLog && !moving) {
      alive = false;
      statusEl.textContent = 'Fim de jogo! Caíste na água.';
      restartBtn.hidden = false;
      return;
    }

    if (Math.abs(player.position.x) > HALF_WIDTH - 1.4) {
      alive = false;
      statusEl.textContent = 'Fim de jogo! Foste levado pela corrente.';
      restartBtn.hidden = false;
    }
  }
}

function updateLanesAndMovers(dt) {
  const laneNow = currentLaneIndex();
  ensureLanesAround(laneNow);

  for (const lane of lanes.values()) {
    for (const mover of lane.movers) {
      mover.mesh.position.x += mover.speed * dt;
      wrapMover(mover);
    }
  }
}

function updateMovement(dt) {
  if (!moving) return;

  moveProgress += dt / MOVE_TIME;
  const t = Math.min(moveProgress, 1);
  const jump = Math.sin(Math.PI * t) * 0.9;

  player.position.lerpVectors(startPos, endPos, t);
  player.position.y = jump;

  if (t >= 1) {
    moving = false;
    player.position.y = 0;

    if (targetLane > maxLaneReached) {
      maxLaneReached = targetLane;
      scoreEl.textContent = String(maxLaneReached);
      statusEl.textContent = 'Continua!';
    }
  }
}

function updateCamera() {
  const focusZ = player.position.z + 8;
  camera.position.z += (player.position.z - 15 - camera.position.z) * 0.08;
  camera.position.x += (player.position.x - camera.position.x) * 0.08;
  camera.lookAt(player.position.x, 0, focusZ);
}

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.03);

  if (alive) {
    updateMovement(dt);
    updateLanesAndMovers(dt);
    detectCollisionAndWater(dt);
  }

  updateCamera();
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
