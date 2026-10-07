// --- RENDERER & SCENE SETUP ---
const scene = new THREE.Scene();
const skyColor = 0x8ec5fc;
const fogColor = 0xc2ddfa;

scene.background = new THREE.Color(skyColor);
scene.fog = new THREE.FogExp2(fogColor, 0.0016);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 3500);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x476839, 0.85);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight(0xfffae8, 1.45);
sun.position.set(280, 420, -180);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 50;
sun.shadow.camera.far = 800;
const d = 160;
sun.shadow.camera.left = -d;
sun.shadow.camera.right = d;
sun.shadow.camera.top = d;
sun.shadow.camera.bottom = -d;
scene.add(sun);

// --- INFINITE WATER HORIZON (ELIMINATES VOIDS) ---
const oceanGeo = new THREE.PlaneGeometry(5000, 5000);
const oceanMat = new THREE.MeshStandardMaterial({
  color: 0x3d7ebd,
  roughness: 0.15,
  metalness: 0.8
});
const ocean = new THREE.Mesh(oceanGeo, oceanMat);
ocean.rotation.x = -Math.PI / 2;
ocean.position.y = -1.5;
scene.add(ocean);

// --- PROCEDURAL ISLAND & CONTINUOUS LOOP CIRCUIT ---
const ISLAND_SIZE = 1200;
const SEGMENTS = 140;
const terrainGeo = new THREE.PlaneGeometry(ISLAND_SIZE, ISLAND_SIZE, SEGMENTS, SEGMENTS);
terrainGeo.rotateX(-Math.PI / 2);

// Mathematical circular ring road with winding lobes
function getTrackCenter(t) {
  // t is 0.0 to 1.0 (looping angle)
  const angle = t * Math.PI * 2;
  const radius = 320 + Math.sin(angle * 3) * 65 + Math.cos(angle * 5) * 35;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const y = 8 + Math.sin(angle * 2) * 9 + Math.cos(angle * 6) * 4;
  return new THREE.Vector3(x, y, z);
}

// Terrain elevation function matching track & hills
function getIslandElevation(x, z) {
  const distFromCenter = Math.sqrt(x * x + z * z);
  if (distFromCenter > 580) return -2.0; // drops into water

  // Find nearest track point
  const angle = Math.atan2(z, x);
  let t = angle / (Math.PI * 2);
  if (t < 0) t += 1.0;
  const trackPt = getTrackCenter(t);
  const distToTrack = Math.hypot(x - trackPt.x, z - trackPt.z);

  // Flatten for the road bed
  const roadWidth = 14;
  const blend = Math.min(Math.max((distToTrack - roadWidth * 0.7) / 40, 0), 1);
  const naturalHills =
    Math.sin(x * 0.015) * Math.cos(z * 0.015) * 18 +
    Math.sin(x * 0.035 + z * 0.02) * 6;

  const islandDome = Math.cos((distFromCenter / 580) * (Math.PI / 2)) * 14;
  const baseTerrain = islandDome + naturalHills;

  return trackPt.y * (1 - blend) + baseTerrain * blend;
}

// Displace terrain vertices
const tPos = terrainGeo.attributes.position;
for (let i = 0; i < tPos.count; i++) {
  const vx = tPos.getX(i);
  const vz = tPos.getZ(i);
  tPos.setY(i, getIslandElevation(vx, vz));
}
terrainGeo.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({
  color: 0x5a8644,
  roughness: 0.9,
  metalness: 0.05,
  flatShading: true
});
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.receiveShadow = true;
scene.add(terrain);

// --- CONSTRUCT THE CONTINUOUS ROAD MESH ---
const ROAD_STEPS = 600;
const ROAD_WIDTH = 13;
const roadPts = [];
for (let i = 0; i <= ROAD_STEPS; i++) {
  const t = i / ROAD_STEPS;
  roadPts.push(getTrackCenter(t === 1.0 ? 0.0 : t));
}

const roadGeo = new THREE.BufferGeometry();
const roadVerts = [];
const roadUvs = [];
const roadIndices = [];

for (let i = 0; i < ROAD_STEPS; i++) {
  const p1 = roadPts[i];
  const p2 = roadPts[(i + 1) % ROAD_STEPS];

  const forward = new THREE.Vector3().subVectors(p2, p1).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(forward, up).normalize().multiplyScalar(ROAD_WIDTH / 2);

  roadVerts.push(
    p1.x - right.x, p1.y + 0.12, p1.z - right.z,
    p1.x + right.x, p1.y + 0.12, p1.z + right.z
  );

  const vIdx = i * 2;
  const nextVIdx = ((i + 1) % ROAD_STEPS) * 2;
  roadIndices.push(vIdx, vIdx + 1, nextVIdx);
  roadIndices.push(vIdx + 1, nextVIdx + 1, nextVIdx);
}

roadGeo.setAttribute("position", new THREE.Float32BufferAttribute(roadVerts, 3));
roadGeo.setIndex(roadIndices);
roadGeo.computeVertexNormals();

const roadMat = new THREE.MeshStandardMaterial({
  color: 0x22262a,
  roughness: 0.7,
  metalness: 0.1
});
const roadMesh = new THREE.Mesh(roadGeo, roadMat);
roadMesh.receiveShadow = true;
scene.add(roadMesh);

// Center road line
const lineGeo = new THREE.BufferGeometry();
const lineVerts = [];
for (let i = 0; i < ROAD_STEPS; i++) {
  const p = roadPts[i];
  lineVerts.push(p.x, p.y + 0.18, p.z);
}
lineVerts.push(roadPts[0].x, roadPts[0].y + 0.18, roadPts[0].z);
lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(lineVerts, 3));
const lineMat = new THREE.LineDashedMaterial({
  color: 0xffffff,
  dashSize: 3.5,
  gapSize: 2.5,
  linewidth: 2
});
const centerLine = new THREE.Line(lineGeo, lineMat);
centerLine.computeLineDistances();
scene.add(centerLine);

// --- SCENERY: PROCEDURAL LOW-POLY TREES ---
const treeGroup = new THREE.Group();
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x402b1c });
const leavesMat = new THREE.MeshLambertMaterial({ color: 0x3b6932, flatShading: true });
const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 3.2, 5);
const leavesGeo = new THREE.ConeGeometry(2.4, 5.5, 5);

for (let i = 0; i < 280; i++) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 90 + Math.random() * 460;
  const tx = Math.cos(angle) * radius;
  const tz = Math.sin(angle) * radius;

  // Don't spawn trees on the road
  let t = angle / (Math.PI * 2);
  if (t < 0) t += 1.0;
  const rPt = getTrackCenter(t);
  if (Math.hypot(tx - rPt.x, tz - rPt.z) < 14) continue;

  const ty = getIslandElevation(tx, tz);
  if (ty < 1.0) continue; // above water

  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1.6;
  trunk.castShadow = true;
  tree.add(trunk);

  const foliage = new THREE.Mesh(leavesGeo, leavesMat);
  foliage.position.y = 4.6;
  foliage.castShadow = true;
  tree.add(foliage);

  tree.position.set(tx, ty, tz);
  const s = 0.7 + Math.random() * 0.6;
  tree.scale.set(s, s, s);
  treeGroup.add(tree);
}
scene.add(treeGroup);

// --- HIGH-ACCURACY CAR MODEL ---
const car = new THREE.Group();

// Sports car body with bevelled aerodynamic frame
const carBodyMat = new THREE.MeshStandardMaterial({
  color: 0xd62828,
  roughness: 0.18,
  metalness: 0.55
});
const blackPlasticMat = new THREE.MeshStandardMaterial({
  color: 0x141414,
  roughness: 0.7
});
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x0f151c,
  roughness: 0.05,
  metalness: 0.95
});
const lightGlowMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xffffff,
  emissiveIntensity: 0.8
});
const brakeGlowMat = new THREE.MeshStandardMaterial({
  color: 0xff1e1e,
  emissive: 0x880000,
  emissiveIntensity: 0.4
});

// Lower chassis
const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 4.5), carBodyMat);
lowerBody.position.y = 0.5;
lowerBody.castShadow = true;
car.add(lowerBody);

// Cabin
const roof = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.55, 2.3), glassMat);
roof.position.set(0, 0.98, -0.2);
roof.castShadow = true;
car.add(roof);

// Front Bumper / Splitter
const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.2, 0.4), blackPlasticMat);
splitter.position.set(0, 0.28, 2.2);
car.add(splitter);

// Headlights & Tail Lights
const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.1), lightGlowMat);
hl1.position.set(-0.7, 0.58, 2.26);
const hl2 = hl1.clone();
hl2.position.x = 0.7;
car.add(hl1, hl2);

const tl1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.1), brakeGlowMat);
tl1.position.set(-0.7, 0.6, -2.26);
const tl2 = tl1.clone();
tl2.position.x = 0.7;
car.add(tl1, tl2);

// Wheels with silver rims
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.38, 20);
wheelGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.4, 12);
rimGeo.rotateZ(Math.PI / 2);
const rimMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.9, roughness: 0.2 });

const wheels = [];
const wheelPositions = [
  [-1.1, 0.42, 1.4],
  [1.1, 0.42, 1.4],
  [-1.1, 0.42, -1.4],
  [1.1, 0.42, -1.4]
];

wheelPositions.forEach(([x, y, z]) => {
  const wGroup = new THREE.Group();
  const tire = new THREE.Mesh(wheelGeo, blackPlasticMat);
  tire.castShadow = true;
  wGroup.add(tire);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  wGroup.add(rim);

  wGroup.position.set(x, y, z);
  car.add(wGroup);
  wheels.push(wGroup);
});

// Start car positioned smoothly on the road
const startPoint = getTrackCenter(0.02);
car.position.set(startPoint.x, startPoint.y + 0.5, startPoint.z);
scene.add(car);

// --- CONTROLS & PHYSICAL STATE ---
const keys = { gas: false, brake: false, left: false, right: false };

window.addEventListener("keydown", (e) => {
  if (e.key === "w" || e.key === "ArrowUp") keys.gas = true;
  if (e.key === "s" || e.key === "ArrowDown") keys.brake = true;
  if (e.key === "a" || e.key === "ArrowLeft") keys.left = true;
  if (e.key === "d" || e.key === "ArrowRight") keys.right = true;
});
window.addEventListener("keyup", (e) => {
  if (e.key === "w" || e.key === "ArrowUp") keys.gas = false;
  if (e.key === "s" || e.key === "ArrowDown") keys.brake = false;
  if (e.key === "a" || e.key === "ArrowLeft") keys.left = false;
  if (e.key === "d" || e.key === "ArrowRight") keys.right = false;
});

function bindButton(id, stateKey) {
  const el = document.getElementById(id);
  const press = (e) => { e.preventDefault(); keys[stateKey] = true; el.classList.add("pressed"); };
  const release = (e) => { e.preventDefault(); keys[stateKey] = false; el.classList.remove("pressed"); };
  el.addEventListener("touchstart", press, { passive: false });
  el.addEventListener("touchend", release, { passive: false });
  el.addEventListener("mousedown", press);
  el.addEventListener("mouseup", release);
  el.addEventListener("mouseleave", release);
}
bindButton("btn-gas", "gas");
bindButton("btn-brake", "brake");
bindButton("btn-left", "left");
bindButton("btn-right", "right");

// Physics variables
let speed = 0;
let carHeading = Math.atan2(roadPts[1].z - roadPts[0].z, roadPts[1].x - roadPts[0].x) - Math.PI / 2;
let steerVal = 0;
let velocityY = 0;

const speedUI = document.getElementById("speedVal");
const gearUI = document.getElementById("gearVal");
const surfaceUI = document.getElementById("surfaceVal");

// --- MAIN LOOP ---
function animate() {
  requestAnimationFrame(animate);

  // Surface detection (Road vs Grass)
  const angle = Math.atan2(car.position.z, car.position.x);
  let t = angle / (Math.PI * 2);
  if (t < 0) t += 1.0;
  const nearestRoad = getTrackCenter(t);
  const distFromRoad = Math.hypot(car.position.x - nearestRoad.x, car.position.z - nearestRoad.z);
  const onGrass = distFromRoad > ROAD_WIDTH / 2;

  surfaceUI.innerText = onGrass ? "OFF-ROAD / GRASS" : "TARMAC";
  surfaceUI.style.color = onGrass ? "#80e27e" : "#ffd166";

  // Dynamic friction based on road contact
  const maxSpd = onGrass ? 0.9 : 1.95;
  const accelRate = onGrass ? 0.012 : 0.024;
  const dragRate = onGrass ? 0.94 : 0.988;

  // Power & Brakes
  if (keys.gas) {
    speed += accelRate;
    brakeGlowMat.emissiveIntensity = 0.3;
  } else if (keys.brake) {
    speed -= 0.045;
    brakeGlowMat.emissiveIntensity = 2.0; // brake lights glow bright
  } else {
    speed *= dragRate;
    brakeGlowMat.emissiveIntensity = 0.3;
  }

  speed = Math.max(-0.45, Math.min(maxSpd, speed));

  // Steering
  const targetSteer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
  steerVal += (targetSteer * 0.038 - steerVal) * 0.18;

  if (Math.abs(speed) > 0.005) {
    const dir = speed >= 0 ? 1 : -1;
    carHeading += steerVal * dir * (speed / maxSpd);
  }

  // Turn front wheels visually
  wheels[0].rotation.y = steerVal * 8;
  wheels[1].rotation.y = steerVal * 8;

  // Wheel roll
  wheels.forEach(w => {
    w.children[0].rotation.x += speed * 0.5;
  });

  // Calculate new position
  car.position.x += Math.sin(carHeading) * speed;
  car.position.z += Math.cos(carHeading) * speed;

  // Raycast/Ground Elevation Clamping
  const groundElevation = getIslandElevation(car.position.x, car.position.z);
  const targetY = groundElevation + 0.15;

  // Smooth suspension snap
  car.position.y += (targetY - car.position.y) * 0.35;

  // Sample slope ahead for pitch calculation
  const aheadX = car.position.x + Math.sin(carHeading) * 2;
  const aheadZ = car.position.z + Math.cos(carHeading) * 2;
  const aheadElevation = getIslandElevation(aheadX, aheadZ);
  const pitch = (aheadElevation - groundElevation) * 0.35;
  const roll = steerVal * speed * 0.45;

  car.rotation.set(-pitch, carHeading, roll);

  // Smooth third-person chase camera
  const camOffset = new THREE.Vector3(
    car.position.x - Math.sin(carHeading) * 11.5,
    car.position.y + 4.6,
    car.position.z - Math.cos(carHeading) * 11.5
  );
  camera.position.lerp(camOffset, 0.12);
  camera.lookAt(
    car.position.x,
    car.position.y + 1.2,
    car.position.z + Math.cos(carHeading) * 4
  );

  // Sunlight tracks the car
  sun.position.set(car.position.x + 180, car.position.y + 350, car.position.z - 140);
  sun.target = car;

  // HUD
  const kmh = Math.round(Math.abs(speed) * 105);
  speedUI.innerText = kmh;
  gearUI.innerText = speed < -0.02 ? "R" : speed > 0.05 ? "D" : "N";

  renderer.render(scene, camera);
}

animate();

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
