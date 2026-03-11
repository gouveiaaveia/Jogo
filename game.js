import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

const canvas = document.querySelector('#game');
const scoreEl = document.querySelector('#score');
const statusEl = document.querySelector('#status');
const restartBtn = document.querySelector('#restart');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 30, 90);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const hemi = new THREE.HemisphereLight(0xffffff, 0x446655, 0.9);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(15, 35, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -35;
sun.shadow.camera.right = 35;
sun.shadow.camera.top = 35;
sun.shadow.camera.bottom = -35;
scene.add(sun);

const LANE_SIZE = 4;
const HALF_WIDTH = 18;
const LANE_COUNT = 45;
const MOVE_TIME = 0.14;

const lanes = [];
const cars = [];
let maxLaneReached = 0;
let alive = true;

const laneColors = {
  grass: 0x7cc768,
  road: 0x2c3138,
  water: 0x3f9be0,
};

const groundGeo = new THREE.BoxGeometry(HALF_WIDTH * 2, 1, LANE_SIZE);

function createLane(index) {
  const typeRoll = Math.random();
  const type = index < 2 ? 'grass' : typeRoll < 0.5 ? 'road' : typeRoll < 0.82 ? 'grass' : 'water';

  const lane = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ color: laneColors[type] })
  );
  lane.position.set(0, -0.5, index * LANE_SIZE);
  lane.receiveShadow = true;
  lane.userData.type = type;
  scene.add(lane);

  lanes[index] = lane;

  if (type === 'road') {
    const carCount = 2 + Math.floor(Math.random() * 3);
    const direction = Math.random() > 0.5 ? 1 : -1;

    for (let i = 0; i < carCount; i += 1) {
      const car = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 1.25, 1.9),
        new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.65, 0.5) })
      );
      car.castShadow = true;
      car.position.y = 0.6;
      car.position.z = index * LANE_SIZE;
      car.position.x = -HALF_WIDTH + i * 12 + Math.random() * 5;

      scene.add(car);
      cars.push({
        mesh: car,
        lane: index,
        speed: (3 + Math.random() * 2.2) * direction,
      });
    }
  }
}

for (let i = 0; i < LANE_COUNT; i += 1) createLane(i);

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
let startPos = new THREE.Vector3();
let endPos = new THREE.Vector3();

const keys = new Set();

function startMove(dx, dz) {
  if (!alive || moving) return;

  const nextX = targetX + dx * LANE_SIZE;
  const nextLane = targetLane + dz;

  if (Math.abs(nextX) > HALF_WIDTH - 2 || nextLane < 0 || nextLane >= LANESafeEnd()) return;

  targetX = nextX;
  targetLane = nextLane;
  moving = true;
  moveProgress = 0;
  startPos.copy(player.position);
  endPos.set(targetX, 0, targetLane * LANE_SIZE);
}

function LANESafeEnd() {
  return LANE_COUNT - 1;
}

window.addEventListener('keydown', (event) => {
  keys.add(event.code);

  if (event.code === 'ArrowUp' || event.code === 'KeyW') startMove(0, 1);
  if (event.code === 'ArrowDown' || event.code === 'KeyS') startMove(0, -1);
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') startMove(-1, 0);
  if (event.code === 'ArrowRight' || event.code === 'KeyD') startMove(1, 0);
});

window.addEventListener('keyup', (event) => keys.delete(event.code));

restartBtn.addEventListener('click', () => {
  alive = true;
  statusEl.textContent = 'Pronto para jogar';
  restartBtn.hidden = true;
  player.position.set(0, 0, 0);
  targetX = 0;
  targetLane = 0;
  maxLaneReached = 0;
  scoreEl.textContent = '0';
});

const clock = new THREE.Clock();

function updateCars(dt) {
  for (const car of cars) {
    car.mesh.position.x += car.speed * dt;

    if (car.mesh.position.x > HALF_WIDTH + 6) car.mesh.position.x = -HALF_WIDTH - 6;
    if (car.mesh.position.x < -HALF_WIDTH - 6) car.mesh.position.x = HALF_WIDTH + 6;

    if (alive && Math.abs(car.mesh.position.z - player.position.z) < 1.2 && Math.abs(car.mesh.position.x - player.position.x) < 1.8) {
      alive = false;
      statusEl.textContent = 'Fim de jogo! Foste atropelado.';
      restartBtn.hidden = false;
    }
  }
}

function updateMovement(dt) {
  if (!moving) return;

  moveProgress += dt / MOVE_TIME;
  const t = Math.min(moveProgress, 1);
  const jump = Math.sin(Math.PI * t) * 0.85;

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

    const lane = lanes[targetLane];
    if (lane?.userData.type === 'water') {
      alive = false;
      statusEl.textContent = 'Fim de jogo! Caíste na água.';
      restartBtn.hidden = false;
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
  updateCars(dt);
  if (alive) updateMovement(dt);
  updateCamera();

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
