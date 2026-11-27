// flight.js — EMBERLINE 11: flight model + waypoint autopilot.
// Fresh code, written for v11. The model is a kinematic point-mass steered by
// bank/pitch/throttle targets — the autopilot feeds those targets through the
// game's own control path, so the flown record is a real simulation, not a
// canned animation. The damaged right engine cuts thrust, pulls the nose
// toward the dead side, and forces a rudder/aileron trim the pilot must hold;
// on final approach that reads as a visible crab into the crosswind.
import { surfaceHeight } from './world.js';

export const FT_PER_M = 3.28084;
export const MS_PER_KT = 0.514444;

export function wrapDeg(a) {
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
}
export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

export function createFlight() {
  return {
    x: 0, z: 1350, alt: 0.5,          // on Bluebird Lake, Tanker Base 7
    hdg: 0, speedKt: 0, bank: 0, pitch: 0, vsFpm: 0,
    throttle: 0, fuelPct: 100, waterL: 0,
    enginePct: 100, heatPct: 38,
    windHdg: 240, windKt: 18,
    t: 0, onGround: true, aglFt: 0, crabDeg: 0, ailTrim: 0,
    // landing readouts (filled by the mission)
    tdFpm: 0, tdZoneM: 0, tdCrab: 0,
  };
}

// One integration step. ctrl = { bank, pitch, throttle } — the control targets.
export function stepFlight(f, ctrl, dt) {
  f.t += dt;
  f.throttle = ctrl.throttle !== undefined ? ctrl.throttle : f.throttle;
  const damaged = f.enginePct < 100;
  // --- bank / pitch move toward their targets at limited rates
  const bankRate = 22;   // deg/s
  const pitchRate = 7;   // deg/s
  f.bank += clamp(ctrl.bank - f.bank, -bankRate * dt, bankRate * dt);
  f.pitch += clamp(ctrl.pitch - f.pitch, -pitchRate * dt, pitchRate * dt);
  // --- asymmetric thrust: the dead right engine pulls the nose left and rolls
  // the aircraft toward the dead side; the autopilot's trim counters it.
  // The residual shows up as a crab (heading vs ground track) on final.
  const asym = damaged ? (100 - f.enginePct) / 100 : 0; // 0..1
  const yawBias = asym * f.throttle * 1.6;               // deg/s toward dead engine
  f.ailTrim = asym * f.throttle * 7;                      // deg of trim held
  // --- turn rate from bank (standard: 1091 * tan(bank) / TAS in knots)
  const bankRad = (f.bank * Math.PI) / 180;
  const turnRate = (1091 * Math.tan(bankRad)) / Math.max(45, f.speedKt); // deg/s
  f.hdg = (f.hdg + (turnRate - yawBias) * dt + 360) % 360;
  // --- speed: throttle drives it, the damaged engine caps it
  const thrustFactor = damaged ? (1 + f.enginePct / 100) / 2 : 1;
  const maxSpeed = 185 * thrustFactor;
  const targetSpeed = ctrl.speedKt !== undefined ? ctrl.speedKt : 110;
  const accel = f.onGround ? 6.5 : 3.2; // kt/s
  const speedTarget = Math.min(targetSpeed, maxSpeed);
  f.speedKt += clamp(speedTarget - f.speedKt, -accel * dt, accel * dt);
  if (f.onGround && f.speedKt < 0) f.speedKt = 0;
  // --- vertical speed from pitch (1 kt = 101.27 fpm)
  const pitchRad = (f.pitch * Math.PI) / 180;
  let vsTarget;
  if (f.onGround) {
    // on the ground: only lift off when pitched up and past rotation speed
    vsTarget = (f.pitch > 2 && f.speedKt > 55) ? f.speedKt * 101.27 * Math.sin(pitchRad) : 0;
  } else {
    vsTarget = f.speedKt * 101.27 * Math.sin(pitchRad);
  }
  f.vsFpm += clamp(vsTarget - f.vsFpm, -900 * dt, 900 * dt);
  // --- altitude + position
  f.alt += (f.vsFpm / 60) * 0.3048 * dt; // fpm -> m/s
  const spdMs = f.speedKt * MS_PER_KT;
  const hdgRad = (f.hdg * Math.PI) / 180;
  f.x += spdMs * Math.sin(hdgRad) * dt;
  f.z -= spdMs * Math.cos(hdgRad) * dt;
  // --- ground / water contact (the surface is the water over the lakes)
  const ground = surfaceHeight(f.x, f.z);
  const aglM = f.alt - ground;
  f.aglFt = aglM * FT_PER_M;
  if (aglM <= 0.2 && f.vsFpm <= 0) {
    if (!f.onGround) f.tdFpm = f.vsFpm; // vertical speed at the moment of contact
    f.alt = ground + 0.2;
    f.onGround = true;
    f.vsFpm = 0;
    if (f.pitch > 0) f.pitch = 0;
  } else if (aglM > 1.5) {
    f.onGround = false;
  }
  // --- fuel burn (throttle-driven; the sortie is long, fuel gets BINGO-low)
  f.fuelPct = Math.max(0, f.fuelPct - f.throttle * 0.27 * dt);
  // --- heat: the damaged engine runs hot at power, cools at idle
  if (damaged) {
    f.heatPct = clamp(f.heatPct + (f.throttle * 6 - 1.2) * dt, 0, 96);
  } else {
    f.heatPct = clamp(f.heatPct + (38 - f.heatPct) * 0.02 * dt, 0, 100);
  }
  // --- crab: heading minus ground-track heading (wind + asymmetry push it).
  // track = atan2(vx, -vz): the velocity's x/z components, with -z = north.
  // (The second argument is -vz = +spd*cos(hdg) - windDrift.z.)
  const track = Math.atan2(
    spdMs * Math.sin(hdgRad) + windDrift(f).x,
    spdMs * Math.cos(hdgRad) - windDrift(f).z
  ) * 180 / Math.PI;
  f.crabDeg = wrapDeg(f.hdg - track);
  return f;
}

// Wind drift vector (m/s) for the crab computation.
function windDrift(f) {
  const w = f.windKt * MS_PER_KT * 0.35; // partial drift — the pilot corrects most of it
  const r = (f.windHdg * Math.PI) / 180;
  return { x: w * Math.sin(r), z: -w * Math.cos(r) };
}

// ---------------------------------------------------------------- autopilot
// Steer toward a waypoint target {x, z, altM, speedKt} and return controls.
// mode 'land' adds the flare logic (pitch up, throttle idle) below 30 ft AGL.
export function autopilot(f, target, dt) {
  const dx = target.x - f.x;
  const dz = target.z - f.z;
  const dist = Math.hypot(dx, dz);
  const bearing = (Math.atan2(dx, -dz) * 180) / Math.PI;
  const hdgErr = wrapDeg(bearing - f.hdg);
  // bank toward the waypoint; hold a touch of opposite bank against the dead engine
  let bank = clamp(hdgErr * 0.55, -28, 28);
  if (f.enginePct < 100) bank += f.ailTrim * 0.4;
  bank = clamp(bank, -30, 30);
  // pitch to hold the target altitude
  const altErr = target.altM - f.alt;
  let pitch = clamp(altErr * 0.12, -11, 11);
  // throttle to hold the target speed
  const speedErr = target.speedKt - f.speedKt;
  let throttle = clamp(0.52 + speedErr * 0.02, 0.12, 0.95);
  // landing flare: below 6 ft AGL on a landing target, settle gently
  // (a small negative pitch keeps a soft descent; a positive pitch would
  // balloon the aircraft back up and it would never touch down; a low flare
  // keeps the float short on a fast approach)
  if (target.mode === 'land' && f.aglFt < 6 && f.aglFt > 0) {
    pitch = -3;
    throttle = 0.2;
  }
  // rollout: on the ground, throttle idle, hold heading, bleed speed to a stop
  if (target.mode === 'rollout') {
    throttle = 0.12;
    pitch = 0;
    bank = clamp(hdgErr * 0.4, -8, 8);
  }
  return { bank, pitch, throttle, speedKt: target.mode === 'rollout' ? 0 : target.speedKt, dist };
}

// Distance (m) from the aircraft to a target point (horizontal only).
export function distTo(f, target) {
  return Math.hypot(target.x - f.x, target.z - f.z);
}
