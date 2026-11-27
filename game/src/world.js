// world.js — EMBERLINE 11: the valley, lake, town, fires, strips, sky.
// Fresh code, written for v11. Units are metres; y is up; north is -z.
// The valley runs north-south. Golden hour: low warm sun from the west.
import * as THREE from 'three';

// ---------------------------------------------------------------- locations
// Every place the mission touches, in world metres.
export const LOC = {
  base:     { x: 0,    z: 1350 },   // Tanker Base 7 — Bluebird Lake water
  lake:     { x: 0,    z: 1350 },   // Bluebird Lake scoop zone (same water)
  town:     { x: -650, z: -850 },   // Town Edge fire
  ridge:    { x: 750,  z: -950 },   // Ridge Line fire, on the north-east ridge
  hollow:   { x: 850,  z: 250 },    // Pine Hollow — cabins + dirt strip (evac)
  fireBase: { x: -450, z: -450 },   // Fire Base water strip — THE LANDING
  cabins:   { x: 700,  z: 120 },    // Ridge Cabins fire (still burning at cover)
};
export const STRIP_HDG = 0; // fire-base strip runs north-south; land heading north (0 deg)

// ---------------------------------------------------------------- terrain height
// Valley floor ~0 in the centre, rising to ridges east/west and a ridge north.
// Smooth bumps so the autopilot's AGL stays sane.
function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
export function terrainHeight(x, z) {
  let h = 0;
  // west ridge
  h += 260 * smoothstep(-1150, -1900, -x);
  // east ridge
  h += 240 * smoothstep(1150, 1900, x);
  // north ridge
  h += 200 * smoothstep(-1150, -1900, z);
  // gentle rolling hills in the valley
  h += 14 * Math.sin(x * 0.0016 + 1.7) * Math.cos(z * 0.0013 - 0.6);
  h += 9 * Math.sin(x * 0.0031 - 0.4) * Math.sin(z * 0.0027 + 1.1);
  // the lake basin dips below the valley floor (water sits at y=0)
  const dl = Math.hypot(x - LOC.lake.x, z - LOC.lake.z);
  h -= 16 * (1 - smoothstep(240, 520, dl));
  // the fire-base pond dips too
  const df = Math.hypot(x - LOC.fireBase.x, z - LOC.fireBase.z);
  h -= 12 * (1 - smoothstep(180, 420, df));
  return h;
}

// ---------------------------------------------------------------- water test
// The aircraft floats on the water, not on the lake bed: the surface height
// is the water level (0.5 m) over the two water bodies, else the terrain.
export function isWater(x, z) {
  if (Math.abs(x - LOC.lake.x) < 380 && Math.abs(z - LOC.lake.z) < 260) return true;
  if (Math.abs(x - LOC.fireBase.x) < 280 && Math.abs(z - LOC.fireBase.z) < 210) return true;
  return false;
}
export function surfaceHeight(x, z) {
  return isWater(x, z) ? 0.5 : terrainHeight(x, z);
}

// ---------------------------------------------------------------- sky + lights
function makeSky(scene) {
  // Big dome: warm orange at the horizon, deep blue at the top.
  const geo = new THREE.SphereGeometry(5200, 24, 16);
  const colors = [];
  const pos = geo.attributes.position;
  const top = new THREE.Color(0x2e4d7a);
  const mid = new THREE.Color(0x7a6a8a);
  const hor = new THREE.Color(0xff9a3c);
  const low = new THREE.Color(0x3a2a22);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 5200;
    if (y > 0.45) c.copy(mid).lerp(top, smoothstep(0.45, 1, y));
    else if (y > 0.02) c.copy(hor).lerp(mid, smoothstep(0.02, 0.45, y));
    else if (y > -0.08) c.copy(low).lerp(hor, smoothstep(-0.08, 0.02, y));
    else c.copy(low);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(geo, mat);
  scene.add(sky);
  // Sun disc low in the west.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(180, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false })
  );
  sun.position.set(-4200, 620, -800);
  sun.lookAt(0, 620, 0);
  scene.add(sun);
  // Warm low sun + cool sky fill.
  const dir = new THREE.DirectionalLight(0xffb347, 2.1);
  dir.position.set(-2600, 900, 400);
  scene.add(dir);
  const hemi = new THREE.HemisphereLight(0x8aa3c7, 0x4a3826, 0.85);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xc78a52, 900, 5200);
}

// ---------------------------------------------------------------- terrain mesh
function makeTerrain(scene) {
  const geo = new THREE.PlaneGeometry(4200, 4200, 72, 72);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const green = new THREE.Color(0x4a6b2f);
  const dry = new THREE.Color(0x7a6b35);
  const rock = new THREE.Color(0x6b5a4a);
  const dark = new THREE.Color(0x2f4a22);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    // colour by height + a patchwork of fields
    const patch = 0.5 + 0.5 * Math.sin(x * 0.004 + 2.0) * Math.cos(z * 0.0035 - 1.0);
    c.copy(green).lerp(dry, patch * 0.55);
    if (h > 120) c.lerp(rock, smoothstep(120, 220, h));
    if (h < 2 && Math.abs(x) < 900 && z > -700) c.lerp(dark, 0.25);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0, 0);
  scene.add(mesh);
}

// ---------------------------------------------------------------- water
function makeWater(scene) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2a6a9a, roughness: 0.25, metalness: 0.1,
    transparent: true, opacity: 0.92,
  });
  // Bluebird Lake
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(760, 520), mat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(LOC.lake.x, 0.5, LOC.lake.z);
  scene.add(lake);
  // Fire-base pond
  const pond = new THREE.Mesh(new THREE.PlaneGeometry(560, 420), mat);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(LOC.fireBase.x, 0.5, LOC.fireBase.z);
  scene.add(pond);
  return { lake, pond };
}

// ---------------------------------------------------------------- town + cabins
function makeTown(scene) {
  const group = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.9 });
  const wall2 = new THREE.MeshStandardMaterial({ color: 0xa8825a, roughness: 0.9 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x7a3a28, roughness: 0.9 });
  const lit = new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: 0xffc857, emissiveIntensity: 0.9 });
  // Deterministic pseudo-random layout (no Math.random at runtime — fixed seed table).
  const seed = [0.13, 0.47, 0.71, 0.29, 0.86, 0.52, 0.94, 0.08, 0.61, 0.35, 0.77, 0.19, 0.58, 0.43, 0.90, 0.26];
  for (let i = 0; i < 15; i++) {
    const s = seed[i];
    const x = LOC.town.x + (s - 0.5) * 320;
    const z = LOC.town.z + ((seed[(i + 5) % 16] - 0.5) * 260);
    const w = 22 + s * 26, d = 18 + ((seed[(i + 3) % 16]) * 20), h = 14 + s * 22;
    const y = terrainHeight(x, z);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), i % 2 ? wall : wall2);
    b.position.set(x, y + h / 2, z);
    b.rotation.y = (s - 0.5) * 0.6;
    group.add(b);
    const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, 8, 4), roof);
    r.position.set(x, y + h + 4, z);
    r.rotation.y = Math.PI / 4 + (s - 0.5) * 0.6;
    group.add(r);
    // lit windows: one warm strip on the front face
    const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 3, 1), lit);
    win.position.set(x, y + h * 0.55, z + d / 2 + 0.6);
    group.add(win);
  }
  // church steeple
  const st = new THREE.Mesh(new THREE.BoxGeometry(16, 34, 16), wall);
  st.position.set(LOC.town.x + 40, terrainHeight(LOC.town.x + 40, LOC.town.z - 30) + 17, LOC.town.z - 30);
  group.add(st);
  const sp = new THREE.Mesh(new THREE.ConeGeometry(11, 18, 4), roof);
  sp.position.set(LOC.town.x + 40, terrainHeight(LOC.town.x + 40, LOC.town.z - 30) + 43, LOC.town.z - 30);
  sp.rotation.y = Math.PI / 4;
  group.add(sp);
  scene.add(group);
  return group;
}

function makeCabins(scene) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const x = LOC.hollow.x - 60 + (i % 3) * 55;
    const z = LOC.hollow.z - 40 + Math.floor(i / 3) * 60;
    const y = terrainHeight(x, z);
    const b = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 12), wood);
    b.position.set(x, y + 4.5, z);
    group.add(b);
    const r = new THREE.Mesh(new THREE.ConeGeometry(11, 6, 4), roof);
    r.position.set(x, y + 12, z);
    r.rotation.y = Math.PI / 4;
    group.add(r);
  }
  // dirt strip at Pine Hollow (evac touchdown)
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 320),
    new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 1 })
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(LOC.hollow.x + 90, terrainHeight(LOC.hollow.x + 90, LOC.hollow.z) + 0.4, LOC.hollow.z);
  group.add(strip);
  scene.add(group);
  return group;
}

// ---------------------------------------------------------------- pine trees
function makeTrees(scene) {
  const group = new THREE.Group();
  const trunk = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 1 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2f5426, roughness: 0.95 });
  const seed = [0.11, 0.37, 0.63, 0.89, 0.21, 0.55, 0.79, 0.03, 0.47, 0.68, 0.92, 0.15, 0.41, 0.74, 0.28, 0.59, 0.83, 0.07, 0.49, 0.66, 0.95, 0.19, 0.44, 0.72, 0.31, 0.57, 0.86, 0.09, 0.52, 0.69, 0.97, 0.23, 0.46, 0.75, 0.33, 0.60, 0.88, 0.12, 0.54, 0.71];
  for (let i = 0; i < 40; i++) {
    const s = seed[i];
    // scatter on the ridges + around the hollow, away from the strips
    const side = i % 2 ? 1 : -1;
    const x = side * (1250 + s * 550);
    const z = -1100 + seed[(i + 7) % 40] * 2400;
    const y = terrainHeight(x, z);
    const h = 16 + s * 14;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 5, 5), trunk);
    t.position.set(x, y + 2.5, z);
    group.add(t);
    const c = new THREE.Mesh(new THREE.ConeGeometry(7 + s * 3, h, 6), leaf);
    c.position.set(x, y + 5 + h / 2, z);
    group.add(c);
  }
  // a few pines near Pine Hollow
  for (let i = 0; i < 8; i++) {
    const s = seed[i + 20];
    const x = LOC.hollow.x - 140 + s * 90;
    const z = LOC.hollow.z + 90 + seed[(i + 3) % 40] * 80;
    const y = terrainHeight(x, z);
    const h = 14 + s * 10;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.5, 4, 5), trunk);
    t.position.set(x, y + 2, z);
    group.add(t);
    const c = new THREE.Mesh(new THREE.ConeGeometry(6, h, 6), leaf);
    c.position.set(x, y + 4 + h / 2, z);
    group.add(c);
  }
  scene.add(group);
  return group;
}

// ---------------------------------------------------------------- fires
// A fire is a group: flame cones + a point light + a smoke column + a char patch.
// setFireState(fire, 'burning' | 'out') switches it. Flames flicker in animate().
function makeFire(scene, x, z, scale) {
  const group = new THREE.Group();
  const y = terrainHeight(x, z);
  group.position.set(x, y, z);
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 1.6, transparent: true, opacity: 0.92 });
  const flameMat2 = new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xffb300, emissiveIntensity: 1.8, transparent: true, opacity: 0.95 });
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry((7 + i * 2) * scale, (16 + i * 5) * scale, 6), i % 2 ? flameMat : flameMat2);
    f.position.set((i - 2) * 9 * scale, (8 + i * 2) * scale, (i % 3 - 1) * 8 * scale);
    group.add(f);
    flames.push(f);
  }
  const light = new THREE.PointLight(0xff6a1a, 60, 320, 1.6);
  light.position.set(0, 22 * scale, 0);
  group.add(light);
  // smoke column: stacked grey spheres, semi-transparent
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0x3a3632, transparent: true, opacity: 0.55, roughness: 1 });
  const smoke = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry((9 + i * 4) * scale, 8, 6), smokeMat);
    s.position.set(i * 3 * scale - 6, (34 + i * 16) * scale, -i * 2 * scale);
    group.add(s);
    smoke.push(s);
  }
  // charred patch on the ground
  const char = new THREE.Mesh(
    new THREE.CircleGeometry(34 * scale, 20),
    new THREE.MeshStandardMaterial({ color: 0x1a140e, roughness: 1 })
  );
  char.rotation.x = -Math.PI / 2;
  char.position.set(0, 0.6, 0);
  char.visible = false;
  group.add(char);
  scene.add(group);
  return { group, flames, light, smoke, char, scale, state: 'burning' };
}
function setFireState(fire, state) {
  fire.state = state;
  const burning = state === 'burning';
  for (const f of fire.flames) f.visible = burning;
  fire.light.visible = burning;
  fire.char.visible = !burning;
  for (const s of fire.smoke) s.material.opacity = burning ? 0.55 : 0.22;
}
function animateFire(fire, t) {
  if (fire.state !== 'burning') return;
  fire.flames.forEach((f, i) => {
    const s = 1 + 0.18 * Math.sin(t * 7 + i * 1.7);
    f.scale.set(s, 1 + 0.25 * Math.sin(t * 9 + i * 2.3), s);
  });
  fire.smoke.forEach((s, i) => {
    s.position.x += Math.sin(t * 0.6 + i) * 0.12;
    s.position.y += 0.05;
    if (s.position.y > 130 * fire.scale) s.position.y = 34 * fire.scale;
  });
}

// ---------------------------------------------------------------- fire-base strip
function makeFireBaseStrip(scene) {
  const group = new THREE.Group();
  const buoyMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 0.7, roughness: 0.6 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.8 });
  // two buoy lines marking the lane (strip runs north-south, 420 m long, 60 m wide)
  for (let i = 0; i < 9; i++) {
    const z = LOC.fireBase.z + 210 - i * 52;
    for (const dx of [-32, 32]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 6), buoyMat);
      b.position.set(LOC.fireBase.x + dx, 1.5, z);
      group.add(b);
    }
  }
  // centreline dashes on the water
  for (let i = 0; i < 7; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(3, 22), whiteMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(LOC.fireBase.x, 0.8, LOC.fireBase.z + 180 - i * 52);
    group.add(dash);
  }
  // threshold bar (the touchdown target)
  const thr = new THREE.Mesh(new THREE.PlaneGeometry(64, 6), whiteMat);
  thr.rotation.x = -Math.PI / 2;
  thr.position.set(LOC.fireBase.x, 0.8, LOC.fireBase.z + 150);
  group.add(thr);
  // windsock at the strip
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 18, 6), new THREE.MeshStandardMaterial({ color: 0x888888 }));
  pole.position.set(LOC.fireBase.x + 44, 9, LOC.fireBase.z + 160);
  group.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(3, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 0.5 }));
  sock.rotation.z = -Math.PI / 2 - 0.4;
  sock.position.set(LOC.fireBase.x + 38, 17, LOC.fireBase.z + 160);
  group.add(sock);
  scene.add(group);
  return group;
}

// ---------------------------------------------------------------- build
export function createWorld(scene) {
  makeSky(scene);
  makeTerrain(scene);
  makeWater(scene);
  makeTown(scene);
  makeCabins(scene);
  makeTrees(scene);
  const fires = {
    town: makeFire(scene, LOC.town.x - 30, LOC.town.z + 20, 1.4),
    ridge: makeFire(scene, LOC.ridge.x, LOC.ridge.z, 1.3),
    cabins: makeFire(scene, LOC.cabins.x, LOC.cabins.z, 0.9),
  };
  makeFireBaseStrip(scene);
  return { fires, setFireState, animateFire };
}
