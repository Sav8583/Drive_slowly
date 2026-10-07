// --- SIMPLEX NOISE FOR SMOOTH NATURAL TERRAIN ---
const simplex = new SimplexNoise();

// --- SCENE & GRAPHICS ENGINE ---
const scene = new THREE.Scene();
const skyColor = 0xa3cdf7;
const fogColor = 0xdbe8f5;

scene.background = new THREE.Color(skyColor);
scene.fog = new THREE.FogExp2(fogColor, 0.0035);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.3, 1200);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Tone mapping replicates high dynamic range photographic look
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
const ambientLight = new THREE.HemisphereLight(0xffffff, 0x4a6341, 0.8);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xfffaed, 1.4);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 450;
const d = 110;
sun.shadow.camera.left = -d;
sun.shadow.camera.right = d;
sun.shadow.camera.top = d;
sun.shadow.camera.bottom = -d;
scene.add(sun);

// --- ROAD GENERATOR MATHEMATICS ---
function getRoadCurve(z) {
  // Multi-frequency curve for organic sweeping bends
  const x = Math.sin(z * 0.005) * 55 + Math.sin(z * 0.0012) * 110;
  const y = Math.cos(z * 0.003) * 16 + Math.sin(z * 0.009) * 6;
  return { x, y };
}

// Terrain elevation formula with smooth falloff near road
function getTerrainElevation(x, z) {
  const road = getRoadCurve(z);
  const dist = Math.abs(x - road.x);
  const roadCut = Math.min(Math.max((dist - 12) / 35, 0), 1);
  const hills = simplex.noise2D(x * 0.003, z * 0.003) * 24 + simplex.noise2D(x * 0.01, z * 0.01) * 6;
  return road.y * (1 - roadCut) + hills * roadCut;
}

// --- MATERIALS ---
const terrainMat = new THREE.MeshStandardMaterial({
  color: 0x6e964b,
  roughness: 0.85,
  metalness: 0.05,
  flatShading: true
});
const roadMat = new THREE.MeshStandardMaterial({
  color: 0x24282e,
  roughness: 0.6,
  metalness: 0.1
});
const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
const treeTrunkMat = new THREE.MeshLambertMaterial({ color: 0x4d321d });
const treeLeavesMat = new THREE.MeshLambertMaterial({ color: 0x3d7037, flatShading: true });

// --- PROCEDURAL RECYCLABLE CHUNKS ---
const ROAD_WIDTH = 12;
const CHUNK_LEN = 300;
const CHUNK_COUNT = 4;
const chunks = [];

function makeTree(x, y, z) {
  const treeGroup = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 3, 5), treeTrunkMat);
  trunk.position.y = 1.5;
  trunk.castShadow = true;
  treeGroup.add(trunk);

  const foliage = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 5), treeLeavesMat);
  foliage.position.y = 4.5;
  foliage.castShadow = true;
  treeGroup.add(foliage);

  treeGroup.position.set(x, y, z);
  return treeGroup;
}

function createChunk(startZ) {
  const group = new THREE.Group();
  const segs = 50;

  // 1. Terrain Mesh
  const geo = new THREE.PlaneGeometry(400, CHUNK_LEN, 32, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const globalZ = startZ - (vz + CHUNK_LEN / 2);
    pos.setY(i, getTerrainElevation(vx, globalZ));
  }
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.position.set(0, 0, startZ - CHUNK_LEN / 2);
  terrain.receiveShadow = true;
  group.add(terrain);

  // 2. Road Surface
  const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, CHUNK_LEN, 1, segs);
  roadGeo.rotateX(-Math.PI / 2);
  const rPos = roadGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const side = rPos.getX(i) > 0 ? 1 : -1;
    const vz = rPos.getZ(i);
    const globalZ = startZ - (vz + CHUNK_LEN / 2);
    const road = getRoadCurve(globalZ);
    rPos.setX(i, road.x + side * (ROAD_WIDTH / 2));
    rPos.setY(i, road.y + 0.08);
  }
  roadGeo.computeVertexNormals();
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.position.set(0, 0, startZ - CHUNK_LEN / 2);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // 3. Center White Line Strip
  const stripeGeo = new THREE.PlaneGeometry(0.35, CHUNK_LEN, 1, segs);
  stripeGeo.rotateX(-Math.PI / 2);
  const sPos = stripeGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const vz = sPos.getZ(i);
    const globalZ = startZ - (vz + CHUNK_LEN / 2);
    const road = getRoadCurve(globalZ);
    sPos.setX(i, road.x);
    sPos.setY(i, road.y + 0.1);
  }
  stripeGeo.computeVertexNormals();
  const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
  stripeMesh.position.set(0, 0, startZ - CHUNK_LEN / 2);
  group.add(stripeMesh);

  // 4. Procedural Trees
  for (let i = 0; i < 28; i++) {
    const zOffset = Math.random() * CHUNK_LEN;
    const globalZ = startZ - zOffset;
    const road = getRoadCurve(globalZ);
    const side = Math.random() > 0.5 ? 1 : -1;
    const dist = 14 + Math.random() * 70;
    const treeX = road.x + side * dist;
    const treeY = getTerrainElevation(treeX, globalZ);
    group.add(makeTree(treeX, treeY, globalZ - (startZ - CHUNK_LEN / 2)));
  }

  scene.add(group);
  return { group, startZ, endZ: startZ - CHUNK_LEN };
}

let currentZ = 60;
for (let i = 0; i < CHUNK_COUNT; i++) {
  chunks.push(createChunk(currentZ));
  currentZ -= CHUNK_LEN;
}

// --- VEHICLE MODEL ---
const car = new THREE.Group();

const bodyMat = new THREE.MeshStandardMaterial({
  color: 0xe63946,
  metalness: 0.6,
  roughness: 0.2
});
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x111625,
  metalness: 0.95,
  roughness: 0.1
});
const wheelMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a,
  roughness: 0.7
});

// Lower chassis
const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.4), bodyMat);
body.position.y = 0.6;
body.castShadow = true;
car.add(body);

// Cabin roof
const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.4), glassMat);
cabin.position.set(0, 1.15, -0.2);
cabin.castShadow = true;
car.add(cabin);

// Wheels
const wheels = [];
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 20);
wheelGeo.rotateZ(Math.PI / 2);
const wheelOffsets = [
  [-1.08, 0.42, 1.35],
  [1.08, 0.42, 1.35],
  [-1.08, 0.42, -1.35],
  [1.08, 0.42, -1.35]
];
wheelOffsets.forEach(([x, y, z]) => {
  const wheel = new THREE.Mesh(wheelGeo, wheelMat);
  wheel.position.set(x, y, z);
  wheel.castShadow = true;
  car.add(wheel);
  wheels.push(wheel);
});

scene.add(car);

// --- INPUT & CONTROLS BINDING ---
const inputs = { forward: false, backward: false, left: false, right: false, handbrake: false };

window.addEventListener("keydown", (e) => {
  if (e.key === "w" || e.key === "ArrowUp") inputs.forward = true;
  if (e.key === "s" || e.key === "ArrowDown") inputs.backward = true;
  if (e.key === "a" || e.key === "ArrowLeft") inputs.left = true;
  if (e.key === "d" || e.key === "ArrowRight") inputs.right = true;
  if (e.code === "Space") inputs.handbrake = true;
  if (e.key === "c" || e.key === "C") toggleCamera();
});

window.addEventListener("keyup", (e) => {
  if (e.key === "w" || e.key === "ArrowUp") inputs.forward = false;
  if (e.key === "s" || e.key === "ArrowDown") inputs.backward = false;
  if (e.key === "a" || e.key === "ArrowLeft") inputs.left = false;
  if (e.key === "d" || e.key === "ArrowRight") inputs.right = false;
  if (e.code === "Space") inputs.handbrake = false;
});

// Bind On-Screen UI Buttons
function bindTouchButton(id, key) {
  const el = document.getElementById(id);
  const press = (e) => { e.preventDefault(); inputs[key] = true; el.classList.add("pressed"); };
  const release = (e) => { e.preventDefault(); inputs[key] = false; el.classList.remove("pressed"); };
  el.addEventListener("mousedown", press);
  el.addEventListener("mouseup", release);
  el.addEventListener("touchstart", press, { passive: false });
  el.addEventListener("touchend", release, { passive: false });
}
bindTouchButton("btn-gas", "forward");
bindTouchButton("btn-brake", "backward");
bindTouchButton("btn-left", "left");
bindTouchButton("btn-right", "right");

// --- VEHICLE DYNAMICS & CAMERA ---
let speed = 0;
let heading = Math.PI;
let steerAngle = 0;
let cameraMode = 0; // 0: Third-person chase, 1: Hood/cockpit view

function toggleCamera() {
  cameraMode = (cameraMode + 1) % 2;
}

const speedElem = document.getElementById("speedVal");
const gearElem = document.getElementById("gearVal");

function animate() {
  requestAnimationFrame(animate);

  // Physics constants
  const MAX_SPEED = 1.85;
  const ACCEL = 0.016;
  const BRAKE = 0.035;
  const DRAG = inputs.handbrake ? 0.94 : 0.99;

  // Acceleration & Braking
  if (inputs.forward) speed += ACCEL;
  else if (inputs.backward) speed -= BRAKE;
  else speed *= DRAG;

  speed = Math.max(-MAX_SPEED * 0.4, Math.min(MAX_SPEED, speed));

  // Steering & Turning Radius
  const targetSteer = (inputs.left ? 1 : 0) - (inputs.right ? 1 : 0);
  steerAngle += (targetSteer * 0.035 - steerAngle) * 0.15;
  
  if (Math.abs(speed) > 0.005) {
    heading += steerAngle * (speed > 0 ? 1 : -1);
  }

  // Front wheels rotation visually
  wheels[0].rotation.y = steerAngle * 6;
  wheels[1].rotation.y = steerAngle * 6;

  // Move Car
  car.position.x += Math.sin(heading) * speed;
  car.position.z += Math.cos(heading) * speed;

  // Match Road Pitch & Height
  const curRoad = getRoadCurve(car.position.z);
  const nextRoad = getRoadCurve(car.position.z - 2.5);
  const roadPitch = (nextRoad.y - curRoad.y) * 0.45;
  car.position.y = curRoad.y + 0.15;

  const roll = steerAngle * speed * 0.6;
  car.rotation.set(-roadPitch, heading, roll);

  // Camera Management
  if (cameraMode === 0) {
    // Third-person smooth follow
    const idealCamPos = new THREE.Vector3(
      car.position.x - Math.sin(heading) * 11,
      car.position.y + 4.2,
      car.position.z - Math.cos(heading) * 11
    );
    camera.position.lerp(idealCamPos, 0.12);
    camera.lookAt(car.position.x, car.position.y + 1.2, car.position.z + Math.cos(heading) * 5);
  } else {
    // Hood view
    camera.position.set(
      car.position.x + Math.sin(heading) * 0.8,
      car.position.y + 1.35,
      car.position.z + Math.cos(heading) * 0.8
    );
    camera.lookAt(
      car.position.x + Math.sin(heading) * 20,
      car.position.y + 1.2,
      car.position.z + Math.cos(heading) * 20
    );
  }

  // Dynamic Sun Tracking
  sun.position.set(car.position.x + 90, car.position.y + 160, car.position.z - 70);
  sun.target = car;

  // Chunk Streaming / Recycling
  chunks.forEach((chunk) => {
    if (car.position.z < chunk.endZ - 50) {
      const minZ = chunks.reduce((min, c) => Math.min(min, c.endZ), Infinity);
      scene.remove(chunk.group);
      const newChunk = createChunk(minZ);
      chunk.group = newChunk.group;
      chunk.startZ = newChunk.startZ;
      chunk.endZ = newChunk.endZ;
    }
  });

  // HUD Update
  const kmh = Math.round(Math.abs(speed) * 110);
  speedElem.innerText = kmh;
  gearElem.innerText = speed < -0.01 ? "R" : speed > 0.05 ? "D" : "N";

  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
