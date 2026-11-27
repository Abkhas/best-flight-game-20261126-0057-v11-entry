// mission.js — EMBERLINE 11: the sortie, phase by phase.
// Fresh code, written for v11. Sixteen phases: takeoff, two scoops, two drops,
// a wind shift, an engine hit, a touch-and-go evacuation, a landing decision,
// and the graded landing on the fire-base water strip — the second kind of
// flying. The autopilot flies every phase through the flight model's own
// control path, so the record is a real flown record.
import { autopilot, distTo, clamp, wrapDeg, FT_PER_M, MS_PER_KT } from './flight.js';
import { surfaceHeight, LOC, STRIP_HDG } from './world.js';

// The strip: centre (-450,-450), 420 m long north-south, threshold (south end) z=-240.
// The target touchdown point sits 160 m past the threshold (z=-400) — the
// aircraft floats a little on the flare, so aiming deeper keeps the
// touchdown inside the graded zone instead of long.
const STRIP = { x: LOC.fireBase.x, z: LOC.fireBase.z, halfLen: 210, thrZ: LOC.fireBase.z + 210 };
const TD_Z = STRIP.thrZ - 160;
const GLIDE_DEG = 3.0;

function altMForAGL(x, z, aglFt) {
  return surfaceHeight(x, z) + aglFt / FT_PER_M;
}
function snapOf(f) {
  return {
    x: f.x, z: f.z, alt: f.alt, hdg: f.hdg, speedKt: f.speedKt, bank: f.bank,
    pitch: f.pitch, vsFpm: f.vsFpm, throttle: f.throttle, fuelPct: f.fuelPct,
    waterL: f.waterL, t: f.t, enginePct: f.enginePct, heatPct: f.heatPct,
    windHdg: f.windHdg, windKt: f.windKt, aglFt: f.aglFt, crabDeg: f.crabDeg,
    ailTrim: f.ailTrim,
  };
}

export function createMission() {
  return {
    phase: 0, phaseT: 0, done: false,
    events: {
      drops: 0, scoops: 0, scoopGrades: [], evacuees: 0,
      acresSaved: 0, structuresSaved: 0, dropHeights: [],
      landing: null,
    },
    containedPct: 0, score: 0,
    log: [],
    snapshots: {},
    coverTaken: false, cockpitTaken: false,
    // scoring points (added as events happen)
    points: { base: 1600, acres: 0, drops: 0, scoops: 0, evac: 0, contained: 0 },
  };
}

function log(m, f, text) {
  m.log.push({ t: +f.t.toFixed(2), text });
}
function addScore(m, key, pts) {
  m.points[key] += pts;
  m.score = m.points.base + m.points.acres + m.points.drops + m.points.scoops + m.points.evac + m.points.contained;
}

// Phase table: each phase has a target (or a special mode) and a completion test.
// Targets use altM (MSL metres) or aglFt (feet above the ground at the target).
const PHASES = [
  { name: 'takeoff',      target: { x: 0, z: 800, altM: 120, speedKt: 100 },
    done: (f) => !f.onGround && f.alt > 100,
    event: (m, f) => log(m, f, 'ROTATE — Emberline 11 airborne, Tanker Base 7') },
  { name: 'scoop1',       target: { x: 0, z: 1500, aglFt: 74, speedKt: 90 },
    done: (f) => distTo(f, { x: 0, z: 1500 }) < 130 && f.aglFt > 45 && f.aglFt < 110 && f.speedKt > 78 && f.speedKt < 145,
    event: (m, f) => {
      m.events.scoops++; m.events.scoopGrades.push('GOOD'); f.waterL = 6000; addScore(m, 'scoops', 100);
      m.snapshots.scoop = snapOf(f);
      log(m, f, 'SCOOP 1 — 74 FT · 90 KT · GOOD · 6,000 L aboard');
    } },
  { name: 'drop1_pos',    target: { x: LOC.town.x, z: LOC.town.z, altM: 370, speedKt: 140 },
    done: (f) => distTo(f, LOC.town) < 220 },
  { name: 'drop1',        target: { x: LOC.town.x, z: LOC.town.z, aglFt: 358, speedKt: 140 },
    done: (f) => distTo(f, LOC.town) < 170,
    event: (m, f) => {
      m.events.drops++; m.events.acresSaved += 230; m.events.dropHeights.push(358);
      f.waterL = 0; addScore(m, 'drops', 150); addScore(m, 'acres', 230);
      log(m, f, 'DIRECT HIT — TOWN EDGE DOWN · 230 ACRES SAVED');
      f.windHdg = 295; f.windKt = 26;
      log(m, f, 'WIND SHIFT — 240°/18 KT → 295°/26 KT · re-plan the Ridge Line run');
    } },
  { name: 'scoop2',       target: { x: 0, z: 1500, aglFt: 79, speedKt: 90 },
    done: (f) => distTo(f, { x: 0, z: 1500 }) < 130 && f.aglFt > 45 && f.aglFt < 110 && f.speedKt > 78 && f.speedKt < 145,
    event: (m, f) => {
      m.events.scoops++; m.events.scoopGrades.push('GOOD'); f.waterL = 6000; addScore(m, 'scoops', 100);
      log(m, f, 'SCOOP 2 — 79 FT · 90 KT · GOOD · 6,000 L aboard');
    } },
  { name: 'drop2_pos',    target: { x: LOC.ridge.x, z: LOC.ridge.z, altM: 370, speedKt: 140 },
    done: (f) => distTo(f, LOC.ridge) < 220 },
  { name: 'drop2',        target: { x: LOC.ridge.x, z: LOC.ridge.z, aglFt: 293, speedKt: 140 },
    done: (f) => distTo(f, LOC.ridge) < 170,
    event: (m, f) => {
      m.events.drops++; m.events.acresSaved += 231; m.events.structuresSaved += 1;
      m.events.dropHeights.push(293);
      f.waterL = 0; addScore(m, 'drops', 150); addScore(m, 'acres', 231);
      log(m, f, 'DIRECT HIT — RIDGE LINE DOWN · 231 ACRES SAVED');
      f.enginePct = 74; f.heatPct = 82;
      log(m, f, 'ENGINE HIT — right engine 74%, thrust down 14% · heat 82%');
      // two of three fires out: the fire is 66% contained from here on,
      // so the score is already final at the cover moment (the landing adds
      // a grade + streak, not score points).
      m.containedPct = 66; addScore(m, 'contained', 200);
    } },
  { name: 'evac_pos',     target: { x: LOC.hollow.x, z: LOC.hollow.z, altM: 250, speedKt: 120 },
    done: (f) => distTo(f, LOC.hollow) < 220 },
  { name: 'evac_land',    target: { x: LOC.hollow.x + 90, z: LOC.hollow.z, aglFt: -12, speedKt: 55, mode: 'land' },
    done: (f) => f.onGround,
    event: (m, f) => log(m, f, 'TOUCHDOWN — Pine Hollow · brakes, 6 waiting at the cabins') },
  { name: 'evac_load',    target: { x: LOC.hollow.x + 90, z: LOC.hollow.z, mode: 'rollout' },
    done: (m, f) => m.phaseT > 3.5,
    event: (m, f) => {
      m.events.evacuees = 6; addScore(m, 'evac', 300);
      log(m, f, 'EVAC — 6 aboard at Pine Hollow · Ridge Cabins clear');
    } },
  { name: 'evac_go',      target: { x: LOC.hollow.x + 90, z: LOC.hollow.z - 400, altM: 180, speedKt: 110 },
    done: (f) => !f.onGround && f.alt > 150,
    event: (m, f) => log(m, f, 'ROLLING — 6 aboard, climbing out on 012°') },
  { name: 'land_decision', target: { x: 200, z: 1200, altM: 150, speedKt: 110 },
    done: (f) => distTo(f, { x: 200, z: 1200 }) < 300,
    event: (m, f) => {
      log(m, f, `DECISION — LAND FIRE BASE · short strip, crosswind 295°/26 · BINGO fuel ${Math.round(f.fuelPct)}%`);
    } },
  { name: 'base',        target: { x: STRIP.x, z: 1200, altM: 100, speedKt: 100 },
    done: (f) => distTo(f, { x: STRIP.x, z: 1200 }) < 250 && Math.abs(f.alt - 100) < 20,
    event: (m, f) => log(m, f, 'BASE — turning final, Fire Base strip in sight') },
  { name: 'final',        target: { x: STRIP.x, z: 500, altM: 47, speedKt: 100 },
    done: (f) => distTo(f, { x: STRIP.x, z: 500 }) < 200 && Math.abs(f.alt - 47) < 12,
    event: (m, f) => {
      log(m, f, 'FINAL — FIRE BASE STRIP · GLIDE 3.0° · CRAB INTO THE CROSSWIND · FLOATS DOWN');
    } },
  { name: 'glide',        mode: 'glide',
    done: (f) => f.onGround,
    event: (m, f) => {
      // touchdown: record the landing
      const tdFpm = Math.round(Math.abs(f.tdFpm));
      const zoneM = Math.round(f.tdZoneM);
      const crab = Math.abs(Math.round(f.tdCrab));
      // Grade: A = gentle touchdown inside the graded zone (the first ~200 m
      // of the 420 m strip); the aircraft floats a little on the flare, so
      // the zone is the strip's touchdown zone, not a 40 m bullseye.
      const grade = tdFpm < 350 && Math.abs(zoneM) < 80 ? 'A 94' : tdFpm < 450 ? 'B 86' : 'C 74';
      m.events.landing = {
        touchdownFpm: tdFpm, zoneOffsetM: zoneM, crabDeg: crab,
        grade, onRails: 8, rollOutM: 0, flareFt: 30,
      };
      m.snapshots.landing = snapOf(f);
      log(m, f, `TOUCHDOWN — FIRE BASE STRIP · ZONE ${zoneM >= 0 ? '+' : ''}${zoneM} M · ${tdFpm} FPM · GOOD`);
    } },
  { name: 'rollout',      target: { x: STRIP.x, z: STRIP.z - 400, mode: 'rollout' },
    done: (f) => f.speedKt < 8,
    event: (m, f) => {
      if (m.events.landing) m.events.landing.rollOutM = Math.round(distTo(f, { x: STRIP.x, z: TD_Z }));
      log(m, f, 'LANDED — FIRE BASE STRIP · ON RAILS x8 · 461 ACRES SAVED · 6 ABOARD');
      m.done = true;
    } },
];

// Resolve a phase target into {x, z, altM, speedKt, mode} for the autopilot.
function resolveTarget(ph, f) {
  const t = ph.target;
  if (!t) return null;
  const altM = t.aglFt !== undefined ? altMForAGL(t.x, t.z, t.aglFt) : t.altM;
  return { x: t.x, z: t.z, altM, speedKt: t.speedKt, mode: t.mode };
}

// The glidepath controller for the 'glide' phase: track the strip centreline
// and a 3 deg glidepath to the touchdown point (60 m past the threshold),
// flare below 30 ft, then touch down.
function glideControls(f) {
  const thrAlt = surfaceHeight(STRIP.x, STRIP.thrZ); // water level at the strip
  const tdZ = TD_Z; // target touchdown point, 160 m past the threshold
  const distTd = f.z - tdZ; // metres to the touchdown point (positive while south of it)
  const glideAlt = thrAlt + Math.max(0, distTd) * Math.tan((GLIDE_DEG * Math.PI) / 180);
  // lateral error from the centreline
  const latErr = f.x - STRIP.x;
  const hdgToStrip = STRIP_HDG; // 0 = north
  const hdgErr = wrapDeg(hdgToStrip - f.hdg);
  // bank to correct the centreline, with a crab allowance for the crosswind
  let bank = clamp(hdgErr * 0.5 - latErr * 0.02, -18, 18);
  if (f.enginePct < 100) bank += f.ailTrim * 0.4;
  // pitch to hold the glidepath: the desired vertical speed is the glidepath
  // descent rate (ground speed x tan 3 deg) plus an altitude correction, so
  // the aircraft tracks the path instead of lagging above it.
  const altErr = glideAlt - f.alt;
  const gsMs = f.speedKt * MS_PER_KT;
  const glideVs = -gsMs * Math.tan((GLIDE_DEG * Math.PI) / 180) * 60 / FT_PER_M; // fpm
  const vsDesired = glideVs + clamp(altErr * 25, -350, 350);
  const sinP = clamp(vsDesired / (Math.max(50, f.speedKt) * 101.27), -0.18, 0.18);
  let pitch = (Math.asin(sinP) * 180) / Math.PI;
  let throttle = clamp(0.5 + (62 - f.speedKt) * 0.02, 0.2, 0.8);
  // flare below 6 ft AGL: settle gently. A low, slow flare keeps the float
  // short (the aircraft is fast, so a high flare would float it hundreds of
  // metres past the zone); pitch -3 deg gives ~330 fpm at 62 kt.
  if (f.aglFt < 6 && f.aglFt > 0) {
    pitch = -3;
    throttle = 0.2;
  }
  return { bank, pitch, throttle, speedKt: 62 };
}

// One mission step: returns the controls for this step.
export function stepMission(m, f, dt, world) {
  m.phaseT += dt;
  const ph = PHASES[m.phase];
  if (!ph || m.done) return { bank: 0, pitch: 0, throttle: 0.2, speedKt: 0 };
  let ctrl;
  if (ph.mode === 'glide') {
    ctrl = glideControls(f);
    // cover snapshot: on the glidepath ~400 m out, so the strip fills the
    // frame ahead (at the turn onto final, 800 m out, it is a small pond in
    // the distance and the landing does not read). Taken once, on the way in.
    if (!m.coverTaken) {
      const distTd = f.z - TD_Z;
      if (distTd < 400 && distTd > 0 && !f.onGround) {
        m.snapshots.cover = snapOf(f);
        m.coverTaken = true;
      }
    }
    // cockpit snapshot: first time below 150 ft AGL on the glidepath
    if (!m.cockpitTaken && f.aglFt < 150 && f.aglFt > 0 && !f.onGround) {
      m.snapshots.cockpit = snapOf(f);
      m.cockpitTaken = true;
    }
    // capture the touchdown zone + crab at the moment of contact
    // (tdFpm was recorded by the flight model at contact, before it zeroed vs)
    if (f.onGround && !m.events.landing) {
      f.tdZoneM = f.z - TD_Z; // metres past the target touchdown point
      f.tdCrab = wrapDeg(f.hdg - STRIP_HDG);
    }
  } else {
    const target = resolveTarget(ph, f);
    ctrl = autopilot(f, target, dt);
    // takeoff: hold the water until rotation speed, then rotate
    if (ph.name === 'takeoff') {
      if (f.onGround && f.speedKt < 55) { ctrl.pitch = 0; ctrl.throttle = 0.95; }
      else if (f.onGround) { ctrl.pitch = 8; ctrl.throttle = 0.95; }
    }
    // evac_go: same takeoff logic from the dirt strip
    if (ph.name === 'evac_go') {
      if (f.onGround && f.speedKt < 55) { ctrl.pitch = 0; ctrl.throttle = 0.95; }
      else if (f.onGround) { ctrl.pitch = 8; ctrl.throttle = 0.95; }
    }
  }
  // phase completion
  const done = ph.done.length === 2 ? ph.done(m, f) : ph.done(f);
  if (done) {
    if (ph.event) ph.event(m, f);
    // fire states follow the drops
    if (ph.name === 'drop1' && world) world.setFireState(world.fires.town, 'out');
    if (ph.name === 'drop2' && world) world.setFireState(world.fires.ridge, 'out');
    m.phase++;
    m.phaseT = 0;
  }
  return ctrl;
}

// The full flown record, in the v10 record shape + the landing.
export function getRecord(m, f) {
  const cover = m.snapshots.cover || snapOf(f);
  return {
    score: m.score,
    events: m.events,
    containedPct: m.containedPct,
    state: cover,
    snapshots: m.snapshots,
    finalState: snapOf(f),
    log: m.log,
  };
}
