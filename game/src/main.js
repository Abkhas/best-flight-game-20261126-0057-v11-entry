// main.js — EMBERLINE 11: entry point.
// Fresh code, written for v11. On load it runs the whole sortie through the
// game's own input path (autopilot -> flight model -> mission, fixed 30 Hz
// steps), then stages the requested shot from the flown record and exposes
// window.__game for the capture harness. The render loop keeps the world
// alive (spinning props, flickering flames, drifting smoke) so every shot is
// a live frame, not a frozen pose.
import * as THREE from 'three';
import { createWorld } from './world.js';
import { createAircraft, poseAircraft } from './aircraft.js';
import { createFlight, stepFlight } from './flight.js';
import { createMission, stepMission, getRecord } from './mission.js';
import { buildGauges } from './hud.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot') || '01-cover';

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1280, 800, false);
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1280 / 800, 0.5, 9000);

// ---------------------------------------------------------------- world + aircraft
const world = createWorld(scene);
const aircraft = createAircraft();
scene.add(aircraft.group);

// ---------------------------------------------------------------- run the sortie
const flight = createFlight();
const mission = createMission();
const DT = 1 / 30;
let steps = 0;
const MAX_STEPS = 30 * 600; // 10 minutes of sim, far past the ~4 min sortie
while (!mission.done && steps < MAX_STEPS) {
  const ctrl = stepMission(mission, flight, DT, world);
  stepFlight(flight, ctrl, DT);
  steps++;
}
const record = getRecord(mission, flight);
// expose the record for the capture harness
window.__game = {
  ready: mission.done,
  getRecord: () => record,
  phase: mission.phase,
  steps,
};

// ---------------------------------------------------------------- stage the shot
buildGauges();
stageShot(shot, record, { scene, camera, aircraft, world });

// ---------------------------------------------------------------- render loop (live frame: props, flames, smoke)
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  for (const p of aircraft.props) p.rotation.z += 0.55;
  world.animateFire(world.fires.town, t);
  world.animateFire(world.fires.ridge, t);
  world.animateFire(world.fires.cabins, t);
  renderer.render(scene, camera);
}
animate();
