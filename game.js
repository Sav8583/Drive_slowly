// --- SCENE & NIGHT ATMOSPHERE ---
const scene = new THREE.Scene();
const nightSky = 0x050a14;
const nightFog = 0x07111e;

scene.background = new THREE.Color(nightSky);
scene.fog = new THREE.FogExp2(nightFog, 0.0035);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// ACES Tone Mapping + High Exposure mimics night photography with specular light bounce
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- NIGHT LIGHTING (MOONLIGHT & AMBIENCE) ---
const ambientLight = new THREE.HemisphereLight(0x38557d, 0x0d1f11, 0.35);
scene.add(ambientLight);

// 3D Luminous Moon in the Sky
const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(18, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xf5f8ff })
);
moonMesh.position.set(300, 380, -400);
scene.add(moonMesh);

// Directional Moonlight
const moonLight = new THREE.DirectionalLight(0xa6c8ff, 0.65);
moonLight.position.copy(moonMesh.position);
moonLight.castShadow = true;
moonLight.shadow.mapSize.width = 2048;
moonLight.shadow.mapSize.height = 2048;
moonLight.shadow.camera.near = 100;
moonLight.shadow.camera.far = 900;
const d = 250;
moonLight.shadow.camera.left = -d;
moonLight.shadow.camera.right = d;
moonLight.shadow.camera.top = d;
moonLight.shadow.camera.bottom = -d;
scene.add(moonLight);

// --- FLAT DARK GREEN JUNGLE TERRAIN ---
const groundGeo = new THREE.PlaneGeometry(2400, 2400);
groundGeo.rotateX(-Math.PI / 2);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x122613, // Dark forest jungle floor
  roughness: 0.95,
  metalness: 0.05
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);

// --- CLOSED CIRCULAR JUNGLE HIGHWAY ---
const ROAD_STEPS = 650;
const ROAD_WIDTH = 13;
const trackPoints = [];

// Closed circular loop with wide, gentle bends
function getTrackPos(t) {
  const angle = t * Math.PI * 2;
  const radius = 340 + Math.sin(angle * 3) * 60 + Math.cos(angle * 2) * 40;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  return new THREE.Vector3(x, 0.05, z); // Pure flat highway
}

for (let i = 0; i <= ROAD_STEPS; i++) {
  const t = i / ROAD_STEPS;
  trackPoints.push(getTrackPos(t === 1.0 ? 0.0 : t));
}

// Build Road Geometry
const roadVerts = [];
const roadIndices = [];
for (let i = 0; i < ROAD_STEPS; i++) {
  const p1 = trackPoints[i];
  const p2 = trackPoints[(i + 1) % ROAD_STEPS];
  const forward = new THREE.Vector3().subVectors(p2, p1).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(forward, up).normalize().multiplyScalar(ROAD_WIDTH / 2);

  roadVerts.push(
    p1.x - right.x, 0.08, p1.z - right.z,
    p1.x + right.x, 0.08, p1.z + right.z
  );

  const idx = i * 2;
  const nextIdx = ((i + 1) % ROAD_STEPS) * 2;
  roadIndices.push(idx, idx + 1, nextIdx);
  roadIndices.push(idx + 1, nextIdx + 1, nextIdx);
}

const roadGeo = new THREE.BufferGeometry();
roadGeo.setAttribute("position", new THREE.Float32BufferAttribute(roadVerts, 3));
roadGeo.setIndex(roadIndices);
roadGeo.computeVertexNormals();

// Wet, reflective asphalt (High specular shine under torches & moonlight)
const roadMat = new THREE.MeshStandardMaterial({
  color: 0x181a1d,
  roughness: 0.28,
  metalness: 0.65
});
const roadMesh = new THREE.Mesh(roadGeo, roadMat);
roadMesh.receiveShadow = true;
scene.add(roadMesh);

// Dashed Center Road Line
const lineVerts = [];
for (let i = 0; i < ROAD_STEPS; i++) {
  const p = trackPoints[i];
  lineVerts.push(p.x, 0.12, p.z);
}
lineVerts.push(trackPoints[0].x, 0.12, trackPoints[0].z);
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(lineVerts, 3));
const lineMat = new THREE.LineDashedMaterial({
  color: 0xffffff,
  dashSize: 3,
  gapSize: 2.5
});
const centerLine = new THREE.Line(lineGeo, lineMat);
centerLine.computeLineDistances();
scene.add(centerLine);

// --- DENSE DARK JUNGLE TREES ---
const treeGroup = new THREE.Group();
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x1f140b });
const jungleLeavesMat = new THREE.MeshStandardMaterial({
  color: 0x0c2912,
  roughness: 0.8,
  metalness: 0.1,
  flatShading: true
});
const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 4, 5);
const leavesGeo = new THREE.ConeGeometry(2.5, 6.5, 5);

for (let i = 0; i < 400; i++) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 80 + Math.random() * 520;
  const tx = Math.cos(angle) * radius;
  const tz = Math.sin(angle) * radius;

  // Don't spawn trees on the asphalt
  let t = angle / (Math.PI * 2);
  if (t < 0) t += 1.0;
  const roadPos = getTrackPos(t);
  if (Math.hypot(tx - roadPos.x, tz - roadPos.z) < 13) continue;

  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 2.0;
  trunk.castShadow = true;
  tree.add(trunk);

  const foliage = new THREE.Mesh(leavesGeo, jungleLeavesMat);
  foliage.position.y = 5.2;
  foliage.castShadow = true;
  tree.add(foliage);

  tree.position.set(tx, 0, tz);
  const s = 0.8 + Math.random() * 0.7;
  tree.scale.set(s, s, s);
  treeGroup.add(tree);
}
scene.add(treeGroup);

// --- VEHICLE 1: RED SPORTS CAR ---
const car = new THREE.Group();
const carPaint = new THREE.MeshStandardMaterial({ color: 0xcc181e, roughness: 0.2, metalness: 0.6 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x080c12, roughness: 0.1, metalness: 0.9 });
const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

const carBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 4.4), carPaint);
carBody.position.y = 0.55;
carBody.castShadow = true;
car.add(carBody);

const carCabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.5, 2.2), glassMat);
carCabin.position.set(0, 0.95, -0.2);
carCabin.castShadow = true;
car.add(carCabin);

const carWheels = [];
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.38, 18);
wheelGeo.rotateZ(Math.PI / 2);
[
  [-1.05, 0.42, 1.35],
  [1.05, 0.42, 1.35],
  [-1.05, 0.42, -1.35],
  [1.05, 0.42, -1.35]
].forEach(([x, y, z]) => {
  const w = new THREE.Mesh(wheelGeo, blackMat);
  w.position.set(x, y, z);
  w.castShadow = true;
  car.add(w);
  carWheels.push(w);
});

// Dual Ray Traced Headlight Torches for Car
function createTorch(offsetX) {
  const light = new THREE.SpotLight(0xfff5d6, 3.2, 70, Math.PI / 7, 0.35, 1.2);
  light.position.set(offsetX, 0.6, 2.2);
  light.target.position.set(offsetX, 0.2, 35);
  light.castShadow = true;
  car.add(light);
  car.add(light.target);
  return light;
}
createTorch(-0.7);
createTorch(0.7);

// --- VEHICLE 2: WHITE SUPERBIKE ---
const bike = new THREE.Group();
const whitePaint = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.15, metalness: 0.7 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdde2e8, roughness: 0.1, metalness: 0.9 });

// Frame & Fuel Tank
const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 1.8), whitePaint);
frame.position.y = 0.85;
frame.castShadow = true;
bike.add(frame);

const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.7), blackMat);
seat.position.set(0, 1.05, -0.35);
bike.add(seat);

// Handlebars
const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), chromeMat);
handlebar.rotateZ(Math.PI / 2);
handlebar.position.set(0, 1.2, 0.6);
bike.add(handlebar);

// Bike Wheels (Thin)
const bikeWheelGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.18, 20);
bikeWheelGeo.rotateZ(Math.PI / 2);
const frontBikeWheel = new THREE.Mesh(bikeWheelGeo, blackMat);
frontBikeWheel.position.set(0, 0.44, 1.05);
frontBikeWheel.castShadow = true;
bike.add(frontBikeWheel);

const rearBikeWheel = new THREE.Mesh(bikeWheelGeo, blackMat);
rearBikeWheel.position.set(0, 0.44, -1.05);
rearBikeWheel.castShadow = true;
bike.add(rearBikeWheel);

// Single Powerful High-Beam Torch for Bike
const bikeTorch = new THREE.SpotLight(0xfff7e6, 3.8, 85, Math.PI / 6.5, 0.35, 1.2);
bikeTorch.position.set(0, 0.9, 1.1);
bikeTorch.target.position.set(0, 0.2, 40);
bikeTorch.castShadow = true;
bike.add(bikeTorch);
bike.add(bikeTorch.target);

// Scene Vehicle Registration
scene.add(car);
scene.add(bike);
bike.visible = false; // start with car

let currentVehicle = car;
let isBike = false;

// Position at start of the road
const startPos = getTrackPos(0.01);
car.position.set(startPos.x, 0, startPos.z);
bike.position.set(startPos.x, 0, startPos.z);

// --- VEHICLE SWITCHING LOGIC ---
const vehNameUI = document.getElementById("vehName");
function switchVehicle() {
  isBike = !isBike;
  if (isBike) {
    bike.position.copy(car.position);
    bike.rotation.copy(car.rotation);
    car.visible = false;
    bike.visible = true;
    currentVehicle = bike;
    vehNameUI.innerText = "WHITE SUPERBIKE";
    vehNameUI.style.color = "#ffffff";
  } else {
    car.position.copy(bike.position);
    car.rotation.copy(bike.rotation);
    bike.visible = false;
    car.visible = true;
    currentVehicle = car;
    vehNameUI.innerText = "RED CAR";
    vehNameUI.style.color = "#ff4d4d";
  }
}
document.getElementById("btn-switch").addEventListener("click", switchVehicle);

// --- INPUTS & CONTROLS ---
const inputs = { gas: false, brake: false, left: false, right: false };

window.addEventListener("keydown", (e) => {
  if (e.key === "w" || e.key === "ArrowUp") inputs.gas = true;
  if (e.key === "s" || e.key === "ArrowDown") inputs.brake = true;
  if (e.key === "a" || e.key === "ArrowLeft") inputs.left = true;
  if (e.key === "d" || e.key === "ArrowRight") inputs.right = true;
  if (e.key === "v" || e.key === "V") switchVehicle();
});
window.addEventListener("keyup", (e) => {
  if (e.key === "w" || e.key === "ArrowUp") inputs.gas = false;
  if (e.key === "s" || e.key === "ArrowDown") inputs.brake = false;
  if (e.key === "a" || e.key === "ArrowLeft") inputs.left = false;
  if (e.key === "d" || e.key === "ArrowRight") inputs.right = false;
});

function bindBtn(id, key) {
  const el = document.getElementById(id);
  const on = (e) => { e.preventDefault(); inputs[key] = true; el.classList.add("pressed"); };
  const off = (e) => { e.preventDefault(); inputs[key] = false; el.classList.remove("pressed"); };
  el.addEventListener("touchstart", on, { passive: false });
  el.addEventListener("touchend", off, { passive: false });
  el.addEventListener("mousedown", on);
  el.addEventListener("mouseup", off);
  el.addEventListener("mouseleave", off);
}
bindBtn("btn-gas", "gas");
bindBtn("btn-brake", "brake");
bindBtn("btn-left", "left");
bindBtn("btn-right", "right");

// --- REALISTIC SPEED & PHYSICS ENGINE ---
let speed = 0;
let heading = Math.atan2(trackPoints[1].z - trackPoints[0].z, trackPoints[1].x - trackPoints[0].x) - Math.PI / 2;
let steerAngle = 0;

const speedUI = document.getElementById("speedVal");
const gearUI = document.getElementById("gearVal");

function animate() {
  requestAnimationFrame(animate);

  // Controlled, realistic driving physics
  const maxForwardSpeed = isBike ? 1.45 : 1.25; // Balanced, non-crazy speed
  const accelRate = isBike ? 0.014 : 0.011;
  const brakeRate = 0.024;
  const coastDrag = 0.991;

  if (inputs.gas) {
    speed += accelRate;
  } else if (inputs.brake) {
    speed -= brakeRate;
  } else {
    speed *= coastDrag;
  }

  // Reverse limit & forward clamp
  speed = Math.max(-0.35, Math.min(maxForwardSpeed, speed));

  // Steering kinematics
  const steerTarget = (inputs.left ? 1 : 0) - (inputs.right ? 1 : 0);
  const steerSpeed = isBike ? 0.045 : 0.035;
  steerAngle += (steerTarget * steerSpeed - steerAngle) * 0.15;

  if (Math.abs(speed) > 0.005) {
    const dir = speed >= 0 ? 1 : -1;
    heading += steerAngle * dir * (speed / maxForwardSpeed);
  }

  // Visual wheel turning / motorcycle banking (lean into corners)
  if (isBike) {
    frontBikeWheel.rotation.y = steerAngle * 4;
    frontBikeWheel.rotation.x += speed * 0.7;
    rearBikeWheel.rotation.x += speed * 0.7;
    const bikeLean = -steerAngle * 1.8; // Motorcycles naturally lean
    bike.rotation.set(0, heading, bikeLean);
  } else {
    carWheels[0].rotation.y = steerAngle * 6;
    carWheels[1].rotation.y = steerAngle * 6;
    carWheels.forEach(w => w.rotation.x += speed * 0.5);
    const carRoll = steerAngle * 0.35;
    car.rotation.set(0, heading, carRoll);
  }

  // Position updates along the pure flat surface (Y = 0)
  currentVehicle.position.x += Math.sin(heading) * speed;
  currentVehicle.position.z += Math.cos(heading) * speed;
  currentVehicle.position.y = 0; // Completely anchored, zero sinking

  // Chase Camera smoothly following current vehicle
  const camDist = isBike ? 8.5 : 10.5;
  const camHeight = isBike ? 3.4 : 4.0;
  const targetCamPos = new THREE.Vector3(
    currentVehicle.position.x - Math.sin(heading) * camDist,
    currentVehicle.position.y + camHeight,
    currentVehicle.position.z - Math.cos(heading) * camDist
  );
  camera.position.lerp(targetCamPos, 0.12);
  camera.lookAt(
    currentVehicle.position.x,
    currentVehicle.position.y + 1.2,
    currentVehicle.position.z + Math.cos(heading) * 4
  );

  // HUD Updates
  const kmh = Math.round(Math.abs(speed) * 95);
  speedUI.innerText = kmh;
  gearUI.innerText = speed < -0.02 ? "R" : speed > 0.04 ? "D" : "N";

  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
