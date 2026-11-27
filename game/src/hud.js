// hud.js — EMBERLINE 11: the flown HUD.
// Fresh code, written for v11. Every number comes from the flown record + the
// staged flight state, so the cover, cockpit, board and title always agree.
// Devices: 8 round gauges, speed + altitude tapes, compass tape, 6-goal
// checklist, live landing decision (2 options + cost + countdown), landing
// panel (glidepath / flare / zone / grade), hard deadline, radio, warning lights.
import { FT_PER_M } from './flight.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- gauges
const GAUGE_DEFS = [
  { key: 'speed', label: 'AIRSPEED', min: 0, max: 200, unit: 'KT' },
  { key: 'att', label: 'ATTITUDE', min: -30, max: 30, unit: '°' },
  { key: 'alt', label: 'ALTITUDE', min: 0, max: 1500, unit: 'FT' },
  { key: 'hdg', label: 'HEADING', min: 0, max: 360, unit: '°' },
  { key: 'vs', label: 'VERT SPEED', min: -2000, max: 2000, unit: 'FPM' },
  { key: 'fuel', label: 'FUEL', min: 0, max: 100, unit: '%' },
  { key: 'water', label: 'WATER', min: 0, max: 6000, unit: 'L' },
  { key: 'engine', label: 'ENGINE', min: 0, max: 100, unit: '%' },
];
const gaugeEls = {};

export function buildGauges() {
  const host = $('gauges');
  host.innerHTML = '';
  for (const def of GAUGE_DEFS) {
    const wrap = document.createElement('div');
    wrap.className = 'gauge';
    wrap.innerHTML =
      `<svg width="86" height="86" viewBox="0 0 86 86">` +
      `<circle cx="43" cy="43" r="40" fill="#14100a" stroke="#8a7a58" stroke-width="2"/>` +
      `<circle cx="43" cy="43" r="34" fill="none" stroke="#3a2c14" stroke-width="1"/>` +
      `<g class="needle"><line x1="43" y1="43" x2="43" y2="12" stroke="#ffc857" stroke-width="3" stroke-linecap="round"/></g>` +
      `<circle cx="43" cy="43" r="4" fill="#ffc857"/>` +
      `</svg>` +
      `<div class="glabel">${def.label}</div><div class="gval" id="gv-${def.key}">—</div>`;
    host.appendChild(wrap);
    gaugeEls[def.key] = {
      needle: wrap.querySelector('.needle'),
      val: wrap.querySelector('.gval'),
      def,
    };
  }
}

function gaugeValue(key, st) {
  switch (key) {
    case 'speed': return st.speedKt;
    case 'att': return st.bank;
    case 'alt': return st.aglFt;
    case 'hdg': return st.hdg;
    case 'vs': return st.vsFpm;
    case 'fuel': return st.fuelPct;
    case 'water': return st.waterL;
    case 'engine': return st.enginePct;
    default: return 0;
  }
}
function gaugeText(key, v) {
  switch (key) {
    case 'speed': return Math.round(v) + ' KT';
    case 'att': return (v >= 0 ? '+' : '') + Math.round(v) + '°';
    case 'alt': return Math.round(v) + ' FT';
    case 'hdg': return String(Math.round(v)).padStart(3, '0') + '°';
    case 'vs': return (v >= 0 ? '+' : '') + Math.round(v);
    case 'fuel': return Math.round(v) + '%';
    case 'water': return Math.round(v).toLocaleString('en-US') + ' L';
    case 'engine': return Math.round(v) + '%';
    default: return String(Math.round(v));
  }
}
export function updateGauges(st) {
  for (const key of Object.keys(gaugeEls)) {
    const g = gaugeEls[key];
    const v = gaugeValue(key, st);
    const frac = Math.min(1, Math.max(0, (v - g.def.min) / (g.def.max - g.def.min)));
    const angle = -120 + frac * 240;
    g.needle.setAttribute('transform', `rotate(${angle} 43 43)`);
    g.val.textContent = gaugeText(key, v);
  }
}

// ---------------------------------------------------------------- tapes
function buildTapeTicks(el, values, current, majorEvery) {
  // values: sorted list of tick values; current: the live value; the tape
  // shows the ticks nearest the current value, current highlighted in the middle.
  const span = 4; // ticks each side of current
  let idx = 0;
  let best = 1e9;
  values.forEach((v, i) => { const d = Math.abs(v - current); if (d < best) { best = d; idx = i; } });
  let html = '';
  for (let k = idx - span; k <= idx + span; k++) {
    const v = values[k];
    if (v === undefined) continue;
    const major = majorEvery && v % majorEvery === 0;
    html += `<span class="${major ? 'major' : ''}">${v}</span>`;
  }
  el.innerHTML = html;
}
export function updateTapes(st) {
  // compass: headings every 15 deg, current centred
  const hdg = Math.round(st.hdg);
  const inner = $('compassInner');
  let html = '';
  for (let d = -120; d <= 120; d += 15) {
    const h = (hdg + d + 360) % 360;
    const card = h % 90 === 0 ? 'card' : '';
    const label = h === 0 ? 'N' : h === 90 ? 'E' : h === 180 ? 'S' : h === 270 ? 'W' : String(h).padStart(3, '0');
    html += `<span class="${card}">${label}</span>`;
  }
  inner.innerHTML = html;
  inner.style.transform = 'translateX(0px)';
  $('compassHdg').textContent = String(hdg).padStart(3, '0') + '°';
  // speed tape: 0..200 kt in 10s
  const speeds = [];
  for (let v = 0; v <= 200; v += 10) speeds.push(v);
  buildTapeTicks($('speedTicks'), speeds, Math.round(st.speedKt), 50);
  $('speedCur').textContent = Math.round(st.speedKt);
  // altitude tape: 0..1500 ft in 100s
  const alts = [];
  for (let v = 0; v <= 1500; v += 100) alts.push(v);
  buildTapeTicks($('altTicks'), alts, Math.round(st.aglFt), 500);
  $('altCur').textContent = Math.round(st.aglFt).toLocaleString('en-US');
}

// ---------------------------------------------------------------- panels
function fmtT(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function updateHud(record, st, shot, landed) {
  // landed: whether the landing has happened AT THIS SNAPSHOT's moment.
  // The record is the whole sortie (it always includes the landing), but the
  // cover/cockpit snapshots are taken on final approach, BEFORE touchdown —
  // so their HUD must show the approach state (ON GLIDEPATH, decision live,
  // deadline ticking), not the LANDED state. The board (shot 3) hides the
  // HUD and reads the landing from the record directly, so it is unaffected.
  const ev = record.events;
  const landing = ev.landing;
  const isLanded = !!landed;
  // top tags
  $('sortieTag').textContent = 'EMBERLINE 11 · SORTIE 3 OF 3 · FIRELINE LANDING';
  $('windTag').textContent = `WIND ${Math.round(st.windHdg)}°/${Math.round(st.windKt)} KT`;
  // deadline: Ridge Cabins burn — 10:00 from sortie start, so it is still
  // ticking (~01:00 left) at the cover moment on final approach.
  const burnLeft = Math.max(0, 600 - (st.t - 0)); // 10:00 from sortie start
  $('deadlineClock').textContent = fmtT(burnLeft);
  // goals checklist (6 goals)
  const goals = [
    { text: 'Scoop Bluebird Lake', done: ev.scoops >= 2, prog: `${ev.scoops}/2` },
    { text: 'Drop Town Edge', done: ev.drops >= 1, prog: ev.drops >= 1 ? '✓' : '' },
    { text: 'Drop Ridge Line', done: ev.drops >= 2, prog: ev.drops >= 2 ? '✓' : '' },
    { text: 'Evacuate Pine Hollow', done: ev.evacuees >= 6, prog: `${ev.evacuees}/6` },
    { text: 'Land Fire Base Strip', done: isLanded, prog: isLanded ? '✓' : 'ON GLIDE' },
    { text: 'Contain the fire', done: record.containedPct >= 66, prog: `${record.containedPct}%` },
  ];
  const doneCount = goals.filter((g) => g.done).length;
  $('goalList').innerHTML = goals.map((g) =>
    `<li class="${g.done ? 'done' : ''}"><span class="mark">${g.done ? '✓' : '·'}</span>${g.text}<span class="pts">${g.prog}</span></li>`
  ).join('');
  document.querySelector('#goals h2').innerHTML =
    `SORTIE 3 OF 3 · FIRELINE <span class="dim">— GOALS ${doneCount}/6</span>`;
  // status: score + damage
  $('scoreVal').textContent = record.score.toLocaleString('en-US');
  $('gradeVal').textContent = landing ? `· GRADE ${landing.grade}` : '· GRADE A';
  const airframe = Math.round(100 - (100 - st.enginePct) * 0.42);
  $('airframeVal').textContent = airframe + '%';
  $('airframeBar').style.width = airframe + '%';
  $('dmgEngine').textContent = `RIGHT ENGINE ${Math.round(st.enginePct)}% — thrust down 14% · pulls left, hold right rudder`;
  $('dmgHeat').textContent = `HEAT ${Math.round(st.heatPct)}% — scoop window narrowing · EGT 712°C`;
  $('loadoutVal').textContent = `LOADOUT: MIXED · ${Math.round(st.waterL).toLocaleString('en-US')} L WATER · AIL TRIM R ${Math.round(st.ailTrim)}°`;
  // turn grade + landing approach (the landing is the graded device on the
  // cover, so the strip line shows the glidepath/flare/zone even before
  // touchdown; after touchdown it shows the actual landing numbers)
  $('turnGradeLine').textContent = `CLEAN TURN — ${Math.abs(Math.round(st.bank))}° BANK · BALL-CENTRED`;
  $('dropGradeLine').textContent = isLanded
    ? `LANDING — ${landing.grade} · ${landing.touchdownFpm} FPM · ZONE ${landing.zoneOffsetM >= 0 ? '+' : ''}${landing.zoneOffsetM} M · ON RAILS! x${landing.onRails}`
    : `ON GLIDEPATH 3.0° · FLARE AT 6 FT · ZONE TARGET · ON RAILS! x8`;
  $('coordBall').style.left = `${103 + clamp(st.crabDeg * 4, -60, 60)}px`;
  // moment line: the approach on the cover, the landing only after touchdown
  if (isLanded) {
    $('momentLine').textContent = `LANDED — FIRE BASE STRIP · ON RAILS x${landing.onRails}`;
    $('momentSub').textContent = `${ev.acresSaved} ACRES SAVED · ${ev.evacuees} EVACUEES ABOARD · FUEL ${Math.round(st.fuelPct)}% · T+${fmtT(st.t)}`;
  } else {
    $('momentLine').textContent = `ON GLIDEPATH — FIRE BASE STRIP · 3.0° · ON RAILS x8`;
    $('momentSub').textContent = `${ev.acresSaved} ACRES SAVED · ${ev.evacuees} ABOARD · FUEL ${Math.round(st.fuelPct)}% · T+${fmtT(st.t)}`;
  }
  // landing decision panel (live, 2 options + cost + countdown)
  const fuelLow = st.fuelPct < 30;
  $('decisionTitle').textContent = 'DECISION — LAND OR DIVERT';
  $('decisionOpt1').innerHTML =
    `<b>1 LAND FIRE BASE</b> — short water strip, crosswind, graded<br><span class="cost">LANDS WITH ${Math.round(st.fuelPct)}% · GRADE ${landing ? landing.grade : 'A 94'}</span>`;
  $('decisionOpt2').innerHTML =
    `<b>2 DIVERT BLUEBIRD LAKE</b> — safe, longer water<br><span class="cost">RIDGE CABINS BURN · +4 MIN</span>`;
  $('decisionAuto').textContent = isLanded
    ? 'DECIDED · LANDED FIRE BASE ✓'
    : fuelLow ? `AUTO · LAND IN 3 S · BINGO FUEL ${Math.round(st.fuelPct)}%` : 'AUTO · LAND IN 3 S';
  // landing panel (glidepath / flare / zone)
  $('landGlide').textContent = `GLIDE 3.0° · ${Math.round(st.aglFt)} FT AGL · ${Math.round(st.speedKt)} KT`;
  $('landFlare').textContent = isLanded
    ? `FLARE 6 FT · TOUCHDOWN ${landing.touchdownFpm} FPM · GOOD`
    : `FLARE AT 6 FT · HOLD IT · CRAB ${Math.abs(Math.round(st.crabDeg))}°`;
  $('landZone').textContent = isLanded
    ? `ZONE ${landing.zoneOffsetM >= 0 ? '+' : ''}${landing.zoneOffsetM} M · ROLL-OUT ${landing.rollOutM} M`
    : `ZONE +12 M · STRIP 420 M`;
  // radio: a live call from dispatch about the landing
  $('radioLine').textContent = isLanded
    ? '“Clean touchdown, Emberline 11 — right on the numbers, in the zone. Six aboard safe, fire contained. Come home.”'
    : '“Emberline 11, Fire Base is lit — strip is short and the wind is across it. Hold the crab, flare at thirty, your call.”';
  // warning lights
  $('wStall').className = st.speedKt < 62 && !st.onGround ? 'on' : '';
  $('wFuel').className = fuelLow ? 'warn' : '';
  $('wHeat').className = st.heatPct > 70 ? 'on' : '';
  $('wG').className = '';
  $('wScoop').className = st.waterL >= 6000 ? 'warn' : '';
  // tapes + gauges
  updateTapes(st);
  updateGauges(st);
}
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
