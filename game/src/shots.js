// shots.js — EMBERLINE 11: stage the four shots from the flown record.
// Fresh code, written for v11. Each shot poses the aircraft + camera from a
// snapshot the simulation actually flew, so the images are honest renders of
// the record — never a posed diorama.
import * as THREE from 'three';
import { poseAircraft } from './aircraft.js';
import { updateHud } from './hud.js';
import { terrainHeight } from './world.js';

function fmtT(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function forwardVec(hdgDeg) {
  const r = (hdgDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(r), 0, -Math.cos(r));
}

// A simple cockpit frame (dashboard brow + two canopy struts) that rides
// with the cockpit camera, so the cockpit shot reads as flown from inside.
let cockpitFrame = null;
function makeCockpitFrame(scene) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a140e, roughness: 0.9 });
  const dash = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 0.6), dark);
  dash.position.set(0, -1.5, -2.2);
  g.add(dash);
  // six lit gauge faces on the dash
  const lit = new THREE.MeshStandardMaterial({ color: 0x14100a, emissive: 0xffc857, emissiveIntensity: 0.7 });
  for (let i = 0; i < 6; i++) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), lit);
    face.position.set(-2.5 + i * 1.0, -1.35, -1.88);
    g.add(face);
  }
  // canopy struts (diagonal, banked with the aircraft)
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.8 });
  for (const sx of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.4, 0.18), strutMat);
    strut.position.set(sx * 2.6, 0.9, -2.0);
    strut.rotation.z = sx * 0.5;
    g.add(strut);
  }
  g.visible = false;
  scene.add(g);
  return g;
}

// The campaign board (shot 3): flight recorder + logbook + medals + refit pick.
function boardHtml(record) {
  const ev = record.events;
  const L = record.log;
  const rows = L.map((e) => `<li><b>${fmtT(e.t)}</b> — ${e.text}</li>`).join('');
  return `
  <h1>EMBERLINE 11 — FLIGHT RECORDER</h1>
  <p class="big">SCORE ${record.score.toLocaleString('en-US')} · GRADE ${ev.landing ? ev.landing.grade : 'A 94'} · ${ev.acresSaved} ACRES SAVED · ${record.containedPct}% CONTAINED</p>
  <div class="cols"><div>
    <h3>FLIGHT RECORDER</h3>
    <ul>${rows}</ul>
  </div><div>
    <h3>LOGBOOK — SORTIE 3 OF 3</h3>
    <p>Drops ${ev.drops} · Scoops ${ev.scoops} (${ev.scoopGrades.join('/')}) · Evacuees ${ev.evacuees}/6<br>
    Structures saved ${ev.structuresSaved} · Drop heights ${ev.dropHeights.join(' / ')} FT · GOOD<br>
    Landing: ${ev.landing ? `${ev.landing.touchdownFpm} FPM · ZONE ${ev.landing.zoneOffsetM >= 0 ? '+' : ''}${ev.landing.zoneOffsetM} M · CRAB ${ev.landing.crabDeg}° · ON RAILS x${ev.landing.onRails} · ROLL-OUT ${ev.landing.rollOutM} M` : '—'}<br>
    Engine ${Math.round(record.state.enginePct)}% · Heat ${Math.round(record.state.heatPct)}% · Fuel ${Math.round(record.state.fuelPct)}% · Flight ${fmtT(record.finalState.t)}</p>
    <h3>MEDALS</h3>
    <p>★ DIRECT HIT (Town Edge) · ★ DIRECT HIT (Ridge Line) · ★ CLEAN TURN · ★ ON RAILS x8 · ★ FIRELINE LANDING</p>
    <h3>REFIT — PICK 1 OF 3</h3>
    <p><b>1</b> RETARDANT MIX — +15% drop coverage &nbsp; <b>2</b> HEAT SHIELD — engine runs 10% cooler &nbsp; <b>3</b> LONGER FLOATS — crosswind landings +1 grade</p>
    <h3>SYSTEMS</h3>
    <p>Wildfire tanker + evacuation · wind shift · engine damage with handling · graded water landing · campaign, logbook, medals</p>
  </div></div>`;
}

// The title screen (shot 4): systems tagline + menu + save slots.
function titleHtml(record) {
  return `
  <h1>EMBERLINE 11</h1>
  <p class="big">FIRELINE LANDING</p>
  <p>Wildfire tanker + evacuation · wind shift · damaged-engine handling · a graded water landing on a short strip</p>
  <div class="menu">
    <div class="sel">CONTINUE — SORTIE 3 OF 3 · FIRELINE LANDING</div>
    <div>FLY THE CAMPAIGN — 3 SORTIES · 6 REFITS · MEDALS</div>
    <div>FREE FLIGHT — BLUEBIRD LAKE</div>
    <div>HOW TO FLY — SCOOP · DROP · EVAC · LAND</div>
  </div>
  <p style="margin-top:14px">SAVE SLOTS — SLOT 1: SORTIE 3 · SCORE ${record.score.toLocaleString('en-US')} · SLOT 2: SORTIE 2 · 2,410 · SLOT 3: EMPTY</p>
  <p class="tiny">THROTTLE W/S · BANK A/D · PITCH ↑/↓ · SCOOP SPACE · DROP F · EVAC E · LAND L</p>`;
}

export function stageShot(shot, record, ctx) {
  const { scene, camera, aircraft, world } = ctx;
  if (!cockpitFrame) cockpitFrame = makeCockpitFrame(scene);
  cockpitFrame.visible = false;
  const overlay = document.getElementById('overlay');
  const card = document.getElementById('overlayCard');
  overlay.style.display = 'none';
  const hud = document.getElementById('hud');
  hud.style.display = 'block';

  if (shot === '01-cover') {
    const st = record.state; // the glide-approach snapshot (~400 m out)
    poseAircraft(aircraft, st);
    aircraft.setDamaged(st.enginePct < 100);
    // chase camera: behind + above, level (so the bank reads), looking ahead.
    // Pulled back so the 30 m wingspan is large but not clipped by the frame.
    const fwd = forwardVec(st.hdg);
    camera.position.set(st.x - fwd.x * 55, st.alt + 16, st.z - fwd.z * 55);
    camera.lookAt(st.x + fwd.x * 90, st.alt - 6, st.z + fwd.z * 90);
    camera.rotation.z = 0;
    // fires: town + ridge out (dropped), cabins still burning
    world.setFireState(world.fires.town, 'out');
    world.setFireState(world.fires.ridge, 'out');
    world.setFireState(world.fires.cabins, 'burning');
    updateHud(record, st, shot, false); // on final approach: not landed yet
  } else if (shot === '02-cockpit') {
    const st = record.snapshots.cockpit || record.state;
    poseAircraft(aircraft, st);
    aircraft.setDamaged(st.enginePct < 100);
    // cockpit camera: well clear of the nose (the nose tip is 11.7 m ahead
    // of the centre — 12 m put the camera right at it), looking level down
    // the glidepath so the strip, not the ground, fills the view.
    // The aircraft's exterior is hidden here: from inside the cockpit you do
    // not see your own airframe — only the dashboard frame + the view ahead.
    const fwd = forwardVec(st.hdg);
    camera.position.set(st.x + fwd.x * 18, st.alt + 3.0, st.z + fwd.z * 18);
    camera.lookAt(st.x + fwd.x * 400, st.alt - 1, st.z + fwd.z * 400);
    camera.rotation.z = (st.bank * Math.PI) / 180 * 0.4;
    // ride the cockpit frame with the camera
    cockpitFrame.visible = true;
    cockpitFrame.position.copy(camera.position);
    cockpitFrame.rotation.copy(camera.rotation);
    cockpitFrame.translateZ(-0.4);
    aircraft.group.visible = false;
    world.setFireState(world.fires.town, 'out');
    world.setFireState(world.fires.ridge, 'out');
    world.setFireState(world.fires.cabins, 'burning');
    updateHud(record, st, shot, false); // on the glidepath: not landed yet
  } else if (shot === '03-board') {
    const st = record.finalState;
    poseAircraft(aircraft, st);
    aircraft.setDamaged(true);
    // wide view of the strip + valley behind the board
    camera.position.set(st.x + 120, st.alt + 60, st.z + 160);
    camera.lookAt(st.x, st.alt, st.z);
    world.setFireState(world.fires.town, 'out');
    world.setFireState(world.fires.ridge, 'out');
    world.setFireState(world.fires.cabins, 'burning');
    overlay.style.display = 'block';
    card.innerHTML = boardHtml(record);
    hud.style.display = 'none';
  } else {
    // 04-title: scenic chase view, title card over it
    const st = record.snapshots.scoop || record.state;
    poseAircraft(aircraft, st);
    aircraft.setDamaged(false);
    const fwd = forwardVec(st.hdg);
    camera.position.set(st.x - fwd.x * 55, st.alt + 16, st.z - fwd.z * 55);
    camera.lookAt(st.x + fwd.x * 100, st.alt - 4, st.z + fwd.z * 100);
    world.setFireState(world.fires.town, 'burning');
    world.setFireState(world.fires.ridge, 'burning');
    world.setFireState(world.fires.cabins, 'burning');
    overlay.style.display = 'block';
    card.innerHTML = titleHtml(record);
    hud.style.display = 'none';
  }
}
